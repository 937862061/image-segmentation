// 工作台逻辑回归：直接执行页面中的类，不依赖浏览器或第三方测试库。
// DOM/Canvas 仅提供测试桩；这里验证数据与交互状态，不代表浏览器视觉验证。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const elements = new Map();
const failedTests = [];
const encodings = [];
const context2d = { drawImage() {}, strokeRect() {}, fillRect() {}, setLineDash() {} };
function element() {
    return { style: {}, dataset: {}, classList: { add() {}, remove() {} }, setAttribute() {}, textContent: '' };
}
function canvas() {
    return {
        ...element(), width: 100, height: 100,
        getBoundingClientRect: () => ({ left: 0, top: 0 }),
        getContext: () => context2d,
        toBlob(callback, type, quality) { encodings.push({ type, quality }); callback({ size: 1 }); }
    };
}
const sandbox = {
    console: {
        log() {}, info() {}, warn() {},
        error(message) { if (String(message).startsWith('✗')) failedTests.push(message); }
    },
    window: { isSecureContext: true, location: { search: '', protocol: 'file:', hostname: '' } },
    navigator: { userAgent: '工作台逻辑测试' },
    document: {
        addEventListener() {}, querySelector: () => null, createElement: canvas,
        getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }
    },
    performance, requestAnimationFrame: callback => callback(),
    setTimeout: callback => { callback(); return 0; }, clearTimeout() {}
};
vm.createContext(sandbox);
const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
vm.runInContext(source + `
globalThis.classes = { ImageCropApp, ImageManager, SelectionManager, EventHandler };
globalThis.setApp = value => { app = value; };
globalThis.suites = [];
const runSuite = SimpleTest.prototype.run;
SimpleTest.prototype.run = function () { const result = runSuite.call(this); suites.push(result); return result; };
globalThis.runExisting = () => {
    runImageUploadTests(); runZoomTests(); runSelectionTests(); runSelectionHighlightTests();
    runSelectionResizeTests(); runSelectionNumberingResetTests(); runExportIntegrityTests(); runIntegrationTests();
};`, sandbox);
const { ImageCropApp, ImageManager, SelectionManager, EventHandler } = sandbox.classes;
const plain = value => JSON.parse(JSON.stringify(value));
function setup() {
    const app = new ImageCropApp();
    app.canvas = canvas();
    app.imageManager = new ImageManager(app.canvas, context2d);
    Object.assign(app.imageManager, { image: {}, originalWidth: 100, originalHeight: 100, displayWidth: 100, displayHeight: 100 });
    app.selectionManager = new SelectionManager();
    app.eventHandler = new EventHandler(app.canvas, app.imageManager, app.selectionManager, { ctx: context2d });
    app.render = () => {};
    app.updateUI = () => {};
    app.updateSelectionList = () => {};
    app.showStatus = message => { app.lastMessage = message; };
    sandbox.setApp(app);
    return app;
}
const mouse = (x, y) => ({ clientX: x, clientY: y });
const key = (app, value, extra = {}) => ({ key: value, target: app.canvas, preventDefault() {}, ...extra });

async function main() {
    let app = setup();
    let manager = app.selectionManager;
    manager.createSelection(20, 20, 60, 60);
    const independent = manager.snapshot();
    independent[0].x = 0;
    assert.equal(manager.getActiveSelection().x, 20, '历史快照必须与当前选区隔离');
    manager.deleteSelection('selection_1');
    app.restoreHistory();
    assert.equal(manager.getAllSelections().length, 1, '删除后应能撤销');
    app.restoreHistory(true);
    assert.equal(manager.getAllSelections().length, 0, '删除后应能重做');
    app.restoreHistory();
    app.editSelection('selection_1', 'width', '60');
    assert.equal(manager.getActiveSelection().width, 60, '宽度输入应更新选区');
    assert.equal(manager.future.length, 0, '撤销后进行新修改应清空重做分支');
    const beforeInvalid = manager.snapshot();
    app.editSelection('selection_1', 'x', '90');
    assert.deepEqual(plain(manager.snapshot()), plain(beforeInvalid), '越界输入不能部分修改选区');
    app.editSelection('selection_1', 'height', '');
    assert.deepEqual(plain(manager.snapshot()), plain(beforeInvalid), '空值不能把尺寸改成零');
    manager.updateSelection('selection_1', { lockedRatio: 1.5 });
    app.editSelection('selection_1', 'width', '45');
    assert.equal(manager.getActiveSelection().height, 30, '锁定比例后另一尺寸应联动');
    app.editSelection('selection_1', 'height', '40');
    assert.equal(manager.getActiveSelection().width, 60, '高度编辑也应保持比例');

    app = setup();
    manager = app.selectionManager;
    manager.createSelection(20, 20, 60, 60);
    let handler = app.eventHandler;
    handler.forceNewSelection = true;
    handler.handleMouseDown(mouse(30, 30));
    handler.handleMouseUp(mouse(50, 50));
    assert.equal(manager.getAllSelections().length, 2, '新建入口应允许在已有选区内框选');
    assert.equal(handler.forceNewSelection, false, '一次新建完成后应恢复普通编辑');
    app.restoreHistory();
    handler.handleMouseDown(mouse(40, 40));
    const historyLength = manager.history.length;
    handler.handleMouseMove(mouse(43, 44));
    handler.handleMouseMove(mouse(45, 46));
    handler.handleMouseUp(mouse(45, 46));
    assert.equal(manager.history.length, historyLength + 1, '连续拖动只能生成一步历史');
    assert.equal(manager.getActiveSelection().x, 25, '拖动应实际改变坐标');
    app.restoreHistory();
    assert.equal(manager.getActiveSelection().x, 20, '撤销手势应恢复初始坐标');
    handler.handleMouseDown(mouse(40, 40));
    handler.handleMouseMove(mouse(50, 50));
    handler.cancelCurrentOperation();
    assert.equal(manager.getActiveSelection().x, 20, '取消手势应撤回未完成的移动');
    handler.handleMouseDown(mouse(40, 40));
    handler.handleMouseMove(mouse(50, 50));
    app.deleteActiveSelection();
    handler.cancelCurrentOperation();
    assert.equal(manager.getAllSelections().length, 0, '手势中删除不能在后续取消时恢复已删除框');
    app.restoreHistory();
    assert.equal(manager.getActiveSelection().x, 20, '撤销手势中的删除应恢复完整原始框');
    handler.nudgeSelection(key(app, 'ArrowRight', { shiftKey: true }));
    assert.equal(manager.getActiveSelection().x, 30, 'Shift 方向键应按原图移动 10px');
    handler.handleKeyDown(key(app, 'z', { ctrlKey: true }));
    assert.equal(manager.getActiveSelection().x, 20, '撤销快捷键应恢复移动');
    handler.handleKeyDown(key(app, ' '));
    handler.handleKeyDown(key(app, ' ', { repeat: true }));
    assert.equal(handler.mode, 'pan', '按住空格及自动重复应保持拖动模式');
    handler.releaseSpacePan();
    assert.equal(handler.mode, 'select', '松开空格应恢复框选模式');
    handler.forceNewSelection = true;
    handler.handleKeyDown(key(app, ' '));
    handler.releaseSpacePan();
    assert.equal(handler.forceNewSelection, true, '临时拖动不能丢失待新建状态');
    handler.cancelCurrentOperation();
    app.showSelections = false;
    handler.handleMouseDown(mouse(40, 40));
    assert.equal(handler.isDragging, false, '隐藏选区时不能误拖动不可见的框');
    app.showSelections = true;
    handler.handleMouseDown(mouse(40, 40));
    handler.handleMouseMove(mouse(45, 45));
    app.canvasRenderer = { clear() {} };
    app.resetApplication();
    assert.equal(manager.getAllSelections().length, 0, '换图重置不能恢复旧手势选区');
    assert.equal(manager.history.length, 0, '新图片应清空旧历史');

    // 八种手柄在图片外拖动，验证尺寸、边界和比例始终成立。
    for (const ratio of [null, 1.5]) {
        for (const handle of ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e']) {
            for (const [x, y] of [[-100, -100], [200, 200], [-100, 200], [200, -100]]) {
                app = setup();
                const selection = app.selectionManager.createSelection(20, 20, 80, 60);
                selection.lockedRatio = ratio;
                handler = app.eventHandler;
                handler.currentSelection = selection;
                handler.originalSelection = { ...selection };
                handler.activeHandle = handle;
                handler.dragStartPos = { x: handle.includes('w') ? 20 : handle.includes('e') ? 80 : 50, y: handle.includes('n') ? 20 : handle.includes('s') ? 60 : 40 };
                handler.resizeSelection(x, y);
                assert.ok(selection.x >= -1e-9 && selection.y >= -1e-9, '边框不能移出图片左上边界');
                assert.ok(selection.x + selection.width <= 100 + 1e-9 && selection.y + selection.height <= 100 + 1e-9, '边框不能移出图片右下边界');
                assert.ok(selection.width >= 10 - 1e-9 && selection.height >= 10 - 1e-9, '调整后的宽高不能小于 10px');
                if (ratio) assert.ok(Math.abs(selection.width / selection.height - ratio) < 1e-9, '所有手柄都应保持锁定比例');
                if (!ratio && handle === 'w') assert.equal(selection.x + selection.width, 80, '拖动左边不能改变右边位置');
            }
        }
    }

    app = setup();
    app.selectionManager.createSelection(10, 10, 30, 30);
    app.selectionManager.createSelection(40, 40, 60, 60);
    const exported = [];
    app.exportSingleSelection = async (selection, filename) => {
        assert.equal(app.isExporting, true, '导出时应保持忙碌状态');
        exported.push(filename);
        if (exported.length === 1) app.selectionManager.deleteSelection('selection_2');
    };
    await app.performExport({ method: 'download', prefix: '检查', format: 'jpeg', useZip: true });
    assert.deepEqual(exported, ['检查_1.jpg', '检查_2.jpg'], 'ZIP 不可用时应按快照导出全部图片');
    assert.equal(app.isExporting, false, '导出后必须解除忙碌状态');
    for (const format of ['jpeg', 'webp']) {
        await app.generateImageBlob({ x: 0, y: 0, width: 20, height: 20 }, { format, quality: 0.2 });
        assert.equal(encodings.at(-1).quality, 0.2, '编码应采用用户选择的质量');
    }
    setup();
    sandbox.runExisting();
    await Promise.all(sandbox.suites);
    assert.deepEqual(failedTests, [], '原有内置测试不能出现失败');
    console.log('通过：选区历史、精确编辑、嵌套新建、手势取消、空格临时拖动、方向键、64 种边框情形、导出快照与质量，以及八组内置逻辑测试。');
}
main().catch(error => { console.error('工作台逻辑检查失败：', error); process.exitCode = 1; });
