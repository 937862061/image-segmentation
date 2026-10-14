// 浏览器回归检查：依赖已安装的 Playwright，可用第二个参数指定模块路径。
// 用法：node tests/ui-smoke.cjs [Playwright模块路径] [截图输出目录]
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.argv[2] || 'playwright');

async function main() {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
        const screenshot = async name => {
            if (process.argv[3]) await page.screenshot({ path: path.join(process.argv[3], name), fullPage: true });
        };
        const count = () => page.evaluate(() => app.selectionManager.getAllSelections().length);
        assert.equal(await page.locator('#exportBtn').isDisabled(), true, '空状态应禁用导出');
        assert.equal(await page.locator('#zoomInBtn').isDisabled(), true, '空状态应禁用缩放');
        // 顶栏只占一行，文件操作与缩放移出左栏，画布铺满其余区域。
        async function checkDesktopLayout(width, height) {
            const header = await page.locator('.app-header').boundingBox();
            const sidebar = await page.locator('.sidebar').boundingBox();
            const canvas = await page.locator('#mainCanvas').boundingBox();
            assert.ok(header.height <= 64, '桌面顶栏应保持紧凑单行');
            assert.equal(sidebar.x, 0, '操作栏应位于最左侧');
            assert.equal(sidebar.y, header.height, '左栏应紧邻顶栏');
            assert.equal(canvas.y, header.height, '画布应从顶栏下沿开始');
            assert.equal(canvas.x, sidebar.width, '画布应紧邻操作栏');
            assert.equal(canvas.width, width - sidebar.width, '画布应铺满右侧宽度');
            assert.equal(canvas.height, height - header.height, '画布应占满顶栏下方高度');
            for (const id of ['selectModeBtn', 'panModeBtn', 'selectionList']) {
                assert.equal(await page.locator(`#${id}`).evaluate(el => Boolean(el.closest('.sidebar'))), true, `${id} 应位于左侧操作区`);
            }
            for (const id of ['uploadBtn', 'exportBtn', 'zoomPreset', 'fitZoomBtn', 'resetZoomBtn']) {
                assert.equal(await page.locator(`#${id}`).evaluate(el => Boolean(el.closest('.app-header'))), true, `${id} 应位于紧凑顶栏`);
            }
            assert.equal(await page.locator('.sidebar').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)', '左栏应恢复浅色');
        }
        await checkDesktopLayout(1440, 900);
        assert.ok((await page.locator('#selectionList').boundingBox()).height >= 250, '桌面选区列表应留出至少 250px 高度');
        await screenshot('workbench-empty.png');

        // 检查两个上传入口确实打开同一文件选择器。
        const chooserPromise = page.waitForEvent('filechooser');
        await page.locator('#welcomeUploadBtn').click();
        const chooser = await chooserPromise;
        // 在内存中生成可预测的 PNG，避免测试依赖外部图片或网络。
        const dataURL = await page.evaluate(() => {
            const canvas = document.createElement('canvas');
            canvas.width = 1200;
            canvas.height = 800;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#b2cabf';
            ctx.fillRect(0, 0, 1200, 800);
            ctx.fillStyle = '#f3e9d8';
            ctx.fillRect(600, 0, 600, 800);
            ctx.fillStyle = '#dd895e';
            ctx.beginPath();
            ctx.arc(800, 280, 140, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#456f63';
            ctx.fillRect(120, 460, 760, 240);
            return canvas.toDataURL('image/png');
        });
        const buffer = Buffer.from(dataURL.split(',')[1], 'base64');
        const file = { name: '示例构图.png', mimeType: 'image/png', buffer };
        await chooser.setFiles(file);
        await page.waitForFunction(() => !app.isLoading && app.imageManager.hasImage());
        assert.equal(await page.locator('#welcomeMessage').isVisible(), false, '加载后应隐藏空状态');
        assert.match(await page.locator('#imageMeta').innerText(), /1200 × 800/, '图片元信息应与原图一致');
        assert.equal(await page.locator('#zoomPreset').inputValue(), await page.evaluate(() => String(app.imageManager.getZoomPercentage())), '非预设缩放比例也应正确显示');

        // 用真实鼠标拖拽框选，坐标从原图映射到当前画布。
        async function dragSelection(x1, y1, x2, y2) {
            const points = await page.evaluate(([a, b, c, d]) => {
                const rect = app.canvas.getBoundingClientRect();
                const start = app.imageManager.imageToCanvas(a, b);
                const end = app.imageManager.imageToCanvas(c, d);
                return { x1: rect.x + start.x, y1: rect.y + start.y, x2: rect.x + end.x, y2: rect.y + end.y };
            }, [x1, y1, x2, y2]);
            await page.mouse.move(points.x1, points.y1);
            await page.mouse.down();
            await page.mouse.move(points.x2, points.y2, { steps: 8 });
            await page.mouse.up();
        }
        await dragSelection(60, 60, 360, 310);
        await dragSelection(650, 100, 1050, 500);
        assert.equal(await count(), 2, '鼠标拖拽应创建两个选区');
        assert.equal(await page.locator('#selectionCount').innerText(), '2', '列表计数应同步');
        assert.equal(await page.locator('#selectionList').evaluate(el => el.scrollHeight <= el.clientHeight), true, '桌面应完整显示两个选区，无需滚动');
        assert.equal(await page.locator('#exportBtn').isEnabled(), true, '存在选区后应允许导出');
        await page.locator('#panModeBtn').click();
        assert.equal(await page.locator('#panModeBtn').getAttribute('aria-pressed'), 'true', '拖动模式应同步可访问状态');
        const panStart = await page.evaluate(() => ({ x: app.imageManager.offsetX, y: app.imageManager.offsetY }));
        const canvasBounds = await page.locator('#mainCanvas').boundingBox();
        await page.mouse.move(canvasBounds.x + 200, canvasBounds.y + 200);
        await page.mouse.down();
        await page.mouse.move(canvasBounds.x + 225, canvasBounds.y + 220, { steps: 5 });
        await page.mouse.up();
        const panEnd = await page.evaluate(() => ({ x: app.imageManager.offsetX, y: app.imageManager.offsetY }));
        assert.ok(panEnd.x !== panStart.x || panEnd.y !== panStart.y, '拖动模式应实际移动图片');
        await page.locator('#selectModeBtn').click();
        await page.locator('#zoomPreset').selectOption('100');
        assert.equal(await page.locator('#zoomPreset').inputValue(), '100', '预设缩放应同步显示');
        await page.locator('#fitZoomBtn').click();
        await page.locator('#mainCanvas').focus();
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => app.selectionManager.getActiveSelection().id), 'selection_1', '画布 Tab 应切换选区');
        await page.keyboard.press('Escape');
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('#mainCanvas').evaluate(el => el === document.activeElement), false, '取消选区后应能用 Tab 离开画布');
        await page.locator('.selection-item').first().focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('.selection-thumbnail').count(), 2, '每个选区应有裁剪缩略图');
        assert.equal(await page.locator('.selection-editor').count(), 1, '仅活动选区应展开尺寸编辑');
        // 编辑尺寸可撤销重做，最终恢复原始裁剪区域，继续验证导出像素。
        const initialWidth = await page.evaluate(() => app.selectionManager.getActiveSelection().width);
        await page.locator('input[data-field="width"]').fill('280');
        await page.locator('input[data-field="width"]').press('Tab');
        assert.equal(await page.evaluate(() => app.selectionManager.getActiveSelection().width), 280, '输入宽度应更新选区');
        await page.locator('#undoBtn').click();
        assert.equal(await page.evaluate(() => app.selectionManager.getActiveSelection().width), initialWidth, '撤销应恢复宽度');
        await page.locator('#redoBtn').click();
        assert.equal(await page.evaluate(() => app.selectionManager.getActiveSelection().width), 280, '重做应重新应用宽度');
        await page.locator('#undoBtn').click();
        await page.locator('input[data-field="lockedRatio"]').check();
        await page.locator('input[data-field="width"]').fill('280');
        await page.locator('input[data-field="width"]').press('Tab');
        const ratio = await page.evaluate(() => { const s = app.selectionManager.getActiveSelection(); return s.width / s.height - s.lockedRatio; });
        assert.ok(Math.abs(ratio) < 1e-9, '尺寸编辑应保持锁定比例');
        await page.locator('#undoBtn').click();
        await page.locator('#undoBtn').click();
        await page.locator('#newSelectionBtn').click();
        await dragSelection(100, 100, 220, 220);
        assert.equal(await count(), 3, '新建选区应允许在已有框内部创建');
        await page.locator('#undoBtn').click();
        assert.equal(await count(), 2, '新建选区应可以撤销');
        await page.locator('#toggleSelectionsBtn').click();
        assert.equal(await page.evaluate(() => app.showSelections), false, '眼睛按钮应隐藏选区显示');
        await page.locator('#toggleSelectionsBtn').click();
        await page.locator('#mainCanvas').focus();
        await page.keyboard.down('Space');
        assert.equal(await page.evaluate(() => app.eventHandler.mode), 'pan', '按住空格应临时拖动画布');
        await page.keyboard.up('Space');
        assert.equal(await page.evaluate(() => app.eventHandler.mode), 'select', '松开空格应恢复框选');
        await screenshot('workbench-editing.png');

        // 导出表单输入空格、退格、Tab 不应触发画布快捷键。
        await page.locator('#exportBtn').click();
        assert.equal(await page.locator('dialog').evaluate(el => el.matches(':modal')), true, '导出应使用原生模态框');
        assert.equal(await page.locator('#zipOptionGroup').isVisible(), true, '少量选区也应允许 ZIP 下载');
        await page.locator('#filenamePrefix').fill('测试 前缀');
        await page.locator('#filenamePrefix').press('Backspace');
        await page.locator('#filenamePrefix').press('Space');
        await page.locator('#filenamePrefix').press('Tab');
        assert.equal(await count(), 2, '表单输入不应删除选区');
        assert.equal(await page.evaluate(() => app.eventHandler.mode), 'select', '表单空格不应切换画布模式');
        await page.locator('#fileFormat').selectOption('jpeg');
        assert.match(await page.locator('#filenamePreview').innerText(), /\.jpg$/, '文件名预览应同步格式');
        assert.equal(await page.locator('#qualityGroup').isVisible(), true, 'JPEG 应显示质量选项');
        await page.locator('#fileFormat').selectOption('png');
        assert.equal(await page.locator('#qualityGroup').isVisible(), false, 'PNG 应隐藏质量选项');
        await screenshot('workbench-export.png');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('dialog'));
        assert.equal(await page.locator('#exportBtn').evaluate(el => el === document.activeElement), true, '关闭弹窗应恢复入口焦点');

        // 验证真实下载的名称、PNG 尺寸及像素，确保 UI 描边没有进入裁剪结果。
        const downloads = [];
        // 鼠标事件落在整数屏幕像素，反算原图时可能有 1px 舍入差异。
        const cropSize = await page.evaluate(() => {
            const first = app.selectionManager.getAllSelections()[0];
            return { width: Math.round(first.width), height: Math.round(first.height) };
        });
        assert.ok(Math.abs(cropSize.width - 300) <= 1 && Math.abs(cropSize.height - 250) <= 1, '拖拽区域应符合目标尺寸');
        page.on('download', download => downloads.push(download));
        await page.locator('#exportBtn').click();
        await page.locator('#filenamePrefix').fill('回归');
        await page.locator('#confirmExportBtn').click();
        await page.waitForFunction(() => document.getElementById('statusMessage').textContent.includes('成功导出'));
        assert.equal(downloads.length, 2, '应下载两个独立裁剪结果');
        assert.equal(downloads[0].suggestedFilename(), '回归_1.png', '下载文件名前缀应生效');
        const png = await fs.readFile(await downloads[0].path());
        assert.equal(png.readUInt32BE(16), cropSize.width, '裁剪结果宽度应等于选区属性');
        assert.equal(png.readUInt32BE(20), cropSize.height, '裁剪结果高度应等于选区属性');
        const pixel = await page.evaluate(async base64 => {
            const image = new Image();
            image.src = 'data:image/png;base64,' + base64;
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);
            return [...ctx.getImageData(0, 0, 1, 1).data];
        }, png.toString('base64'));
        assert.deepEqual(pixel, [178, 202, 191, 255], '裁剪像素应保持原图颜色');
        assert.equal(await count(), 2, '导出后应保留全部选区');

        // 点击 SVG 图标内部删除，避免按钮事件冒泡重新选中已删除条目。
        await page.locator('.delete-action .icon').first().click();
        assert.equal(await count(), 1, '图标内部点击应正确删除选区');
        await page.locator('.selection-item').focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('.selection-item.active').count(), 1, '列表 Enter 应选中条目');
        await page.locator('#shortcutsToggle').click();
        assert.equal(await page.locator('#shortcutsToggle').getAttribute('aria-expanded'), 'true', '快捷键展开状态应同步');
        await page.locator('#shortcutsToggle').click();

        // 对笔记本与窄屏检查溢出，截图保留视觉验证依据。
        for (const [width, height] of [[1024, 768], [768, 600], [390, 844], [320, 640]]) {
            await page.setViewportSize({ width, height });
            // 浏览器异步派发 resize，尺寸检查必须等画布完成同步后再执行。
            await page.waitForFunction(() => {
                const canvas = document.getElementById('mainCanvas');
                const bounds = canvas.parentElement.getBoundingClientRect();
                return Math.abs(canvas.width - bounds.width) < 1 && Math.abs(canvas.height - bounds.height) < 1;
            });
            if (width > 760) await checkDesktopLayout(width, height);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px 宽度不应出现横向溢出`);
            const bounds = await page.locator('#mainCanvas').boundingBox();
            assert.ok(bounds.width > 250 && bounds.height > 250, `${width}px 宽度下画布应保持可用`);
            await screenshot(`workbench-${width}.png`);
        }
        await page.emulateMedia({ reducedMotion: 'reduce' });
        assert.equal(await page.locator('#uploadBtn').evaluate(el => getComputedStyle(el).transitionDuration), '0s', '减少动态效果时应取消过渡');

        // 相同文件可重复导入；非法文件应显示中文错误且恢复上传入口。
        await page.locator('#imageInput').setInputFiles(file);
        await page.waitForFunction(() => !app.isLoading);
        assert.equal(await count(), 0, '重新上传应重置选区');
        await page.locator('#imageInput').setInputFiles({ name: '损坏.png', mimeType: 'image/png', buffer: Buffer.from('invalid') });
        await page.waitForFunction(() => !app.isLoading);
        assert.match(await page.locator('#statusMessage').innerText(), /图片加载失败/, '损坏图片应显示中文报错');
        assert.equal(await page.locator('#welcomeUploadBtn').isEnabled(), true, '失败后应能重新上传');
        assert.equal(await page.locator('#welcomeMessage').isVisible(), true, '失败后应恢复空状态');

        // 文件拖入画布复用原有读取逻辑，覆盖拖拽提示和重新加载状态。
        await page.evaluate(base64 => {
            const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
            const transfer = new DataTransfer();
            transfer.items.add(new File([bytes], '拖拽示例.png', { type: 'image/png' }));
            const target = document.querySelector('.canvas-container');
            target.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: transfer }));
            target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
        }, dataURL.split(',')[1]);
        await page.waitForFunction(() => !app.isLoading && app.imageManager.hasImage());
        assert.equal(await page.locator('#imageName').innerText(), '拖拽示例.png', '拖拽应正确显示图片名');
        assert.equal(await page.locator('.drag-overlay').count(), 0, '完成拖拽后应清除提示遮罩');
        await page.reload();
        await screenshot('workbench-empty-mobile.png');
        assert.equal(await page.locator('#welcomeUploadBtn').isVisible(), true, '窄屏空状态上传入口应可见');
        assert.deepEqual(errors, [], '页面运行不应出现未捕获错误');
        console.log('通过：上传、框选、模式、缩放、键盘、弹窗、真实 PNG 下载、删除、四种屏幕宽度、减少动态效果及加载失败恢复。');
    } finally {
        await browser.close();
    }
}

main().catch(error => {
    console.error('界面回归检查失败：', error);
    process.exitCode = 1;
});
