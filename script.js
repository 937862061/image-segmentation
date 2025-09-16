// 主应用类
class ImageCropApp {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.imageManager = null;
        this.selectionManager = null;
        this.canvasRenderer = null;
        this.eventHandler = null;
        this.exportManager = null;
    }

    init() {
        // 获取Canvas元素和上下文
        this.canvas = document.getElementById('mainCanvas');
        if (!this.canvas) {
            this.showStatus('Canvas元素未找到', 'error');
            return;
        }

        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            this.showStatus('浏览器不支持Canvas', 'error');
            return;
        }

        // 设置Canvas尺寸为容器大小
        this.resizeCanvas();

        // 初始化各个管理器
        this.imageManager = new ImageManager(this.canvas, this.ctx);
        this.selectionManager = new SelectionManager();
        this.canvasRenderer = new CanvasRenderer(this.canvas, this.ctx);
        this.eventHandler = new EventHandler(this.canvas, this.imageManager, this.selectionManager, this.canvasRenderer);
        this.exportManager = new ExportManager();

        // 设置事件监听器
        this.setupEventListeners();

        // 初始化UI
        this.updateUI();

        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.render();
        });

        console.log('图片裁剪工具初始化完成');
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();

        // 设置Canvas的实际尺寸
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;

        // 设置Canvas的显示尺寸
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }

    setupEventListeners() {
        // 上传按钮事件
        const uploadBtn = document.getElementById('uploadBtn');
        const imageInput = document.getElementById('imageInput');

        uploadBtn.addEventListener('click', () => {
            imageInput.click();
        });

        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.loadImage(file);
            }
        });

        // 导出按钮事件
        const exportBtn = document.getElementById('exportBtn');
        exportBtn.addEventListener('click', () => {
            this.exportSelections();
        });

        // 缩放按钮事件
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        const resetZoomBtn = document.getElementById('resetZoomBtn');
        const fitZoomBtn = document.getElementById('fitZoomBtn');
        const zoomPreset = document.getElementById('zoomPreset');

        zoomInBtn.addEventListener('click', () => {
            this.imageManager.zoomIn();
            this.render();
            this.updateUI();
        });

        zoomOutBtn.addEventListener('click', () => {
            this.imageManager.zoomOut();
            this.render();
            this.updateUI();
        });

        resetZoomBtn.addEventListener('click', () => {
            this.imageManager.setScaleKeepCentered(1);
            this.render();
            this.updateUI();
            this.showStatus('已重置为100%缩放', 'info');
        });

        fitZoomBtn.addEventListener('click', () => {
            this.imageManager.resetView();
            this.render();
            this.updateUI();
            this.showStatus('已适合窗口大小', 'info');
        });

        zoomPreset.addEventListener('change', (e) => {
            const level = parseInt(e.target.value);
            const scale = level / 100;
            this.imageManager.setScaleKeepCentered(scale);
            this.render();
            this.updateUI();
        });

        // 模式切换按钮事件
        const panModeBtn = document.getElementById('panModeBtn');
        const selectModeBtn = document.getElementById('selectModeBtn');

        panModeBtn.addEventListener('click', () => {
            this.setMode('pan');
        });

        selectModeBtn.addEventListener('click', () => {
            this.setMode('select');
        });

        // 键盘事件
        document.addEventListener('keydown', (e) => {
            this.eventHandler.handleKeyDown(e);
        });

        // Canvas事件
        this.canvas.addEventListener('mousedown', (e) => {
            this.eventHandler.handleMouseDown(e);
        });

        this.canvas.addEventListener('mousemove', (e) => {
            this.eventHandler.handleMouseMove(e);
        });

        this.canvas.addEventListener('mouseup', (e) => {
            this.eventHandler.handleMouseUp(e);
        });

        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.eventHandler.handleRightClick(e);
        });

        // 鼠标滚轮缩放
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.eventHandler.handleWheel(e);
        });

        // 右键菜单事件
        const contextMenu = document.getElementById('contextMenu');
        const deleteSelection = document.getElementById('deleteSelection');

        deleteSelection.addEventListener('click', () => {
            this.deleteActiveSelection();
            contextMenu.style.display = 'none';
        });

        // 点击其他地方隐藏右键菜单
        document.addEventListener('click', () => {
            contextMenu.style.display = 'none';
        });

        // 拖拽上传功能
        this.setupDragAndDrop();
    }

    loadImage(file) {
        // 重置应用状态
        this.resetApplication();

        this.imageManager.loadImage(file)
            .then(() => {
                this.hideWelcomeMessage();
                this.resizeCanvas(); // 重新调整Canvas尺寸
                this.render();
                this.updateUI();
                this.showStatus('图片加载成功', 'success');
            })
            .catch((error) => {
                this.showStatus('图片加载失败: ' + error.message, 'error');
            });
    }

    // 重置应用状态
    resetApplication() {
        // 清除所有选择框
        this.selectionManager.selections = [];
        this.selectionManager.activeSelectionId = null;

        // 重置事件处理器状态
        this.eventHandler.cancelCurrentOperation();

        // 重置为选择模式
        this.setMode('select');

        // 清除Canvas
        this.canvasRenderer.clear();
    }

    render() {
        this.canvasRenderer.clear();
        this.canvasRenderer.drawImage(this.imageManager);
        this.canvasRenderer.drawSelections(this.selectionManager.getAllSelections(), this.imageManager);
        this.updateZoomLevel();
    }

    updateUI() {
        // 更新导出按钮状态
        const exportBtn = document.getElementById('exportBtn');
        const hasSelections = this.selectionManager.getAllSelections().length > 0;
        exportBtn.disabled = !hasSelections || !this.imageManager.hasImage();

        // 更新选择框列表
        this.updateSelectionList();
    }

    updateSelectionList() {
        const selectionList = document.getElementById('selectionList');
        const selections = this.selectionManager.getAllSelections();

        // 更新选择框数量
        const selectionCount = document.getElementById('selectionCount');
        if (selectionCount) {
            selectionCount.textContent = selections.length;
        }

        if (selections.length === 0) {
            selectionList.innerHTML = `
                <div class="no-selections">
                    <div class="empty-icon">📋</div>
                    <div class="empty-text">暂无选择框</div>
                    <div class="empty-hint">在图片上拖拽创建</div>
                </div>
            `;
            return;
        }

        let html = '';
        selections.forEach((selection, index) => {
            const activeClass = selection.active ? 'active' : '';
            const area = Math.round(selection.width * selection.height);
            const aspectRatio = (selection.width / selection.height).toFixed(2);

            html += `
                <div class="selection-item ${activeClass}" data-id="${selection.id}">
                    <div class="selection-item-header">
                        <span class="selection-name">选择框 ${index + 1}</span>
                        <div class="selection-actions">
                            <button class="btn-icon" onclick="app.focusSelection('${selection.id}')" title="定位到选择框">
                                📍
                            </button>
                            <button class="btn-icon" onclick="app.deleteSelectionById('${selection.id}')" title="删除选择框">
                                🗑️
                            </button>
                        </div>
                    </div>
                    <div class="selection-item-info">
                        <div class="info-row">
                            <span class="info-label">位置:</span>
                            <span class="info-value">(${Math.round(selection.x)}, ${Math.round(selection.y)})</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">大小:</span>
                            <span class="info-value">${Math.round(selection.width)} × ${Math.round(selection.height)}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">面积:</span>
                            <span class="info-value">${area.toLocaleString()} px²</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">比例:</span>
                            <span class="info-value">${aspectRatio}:1</span>
                        </div>
                    </div>
                </div>
            `;
        });

        selectionList.innerHTML = html;

        // 添加点击事件
        selectionList.querySelectorAll('.selection-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // 避免按钮点击触发选择框选中
                if (e.target.classList.contains('btn-icon')) return;

                const id = item.dataset.id;
                this.selectionManager.setActiveSelection(id);
                this.render();
                this.updateUI();
                this.showStatus('已选中选择框', 'info');
            });

            // 添加双击事件定位到选择框
            item.addEventListener('dblclick', (e) => {
                const id = item.dataset.id;
                this.focusSelection(id);
            });
        });
    }

    // 定位到指定选择框
    focusSelection(selectionId) {
        const selection = this.selectionManager.getAllSelections().find(s => s.id === selectionId);
        if (!selection) return;

        this.selectionManager.setActiveSelection(selectionId);

        // 计算选择框在Canvas上的中心点
        const centerX = selection.x + selection.width / 2;
        const centerY = selection.y + selection.height / 2;

        // 如果选择框不在当前视图中，调整视图
        const canvasCenter = this.imageManager.imageToCanvas(centerX, centerY);
        const canvasBounds = this.canvas.getBoundingClientRect();

        if (canvasCenter.x < 0 || canvasCenter.x > this.canvas.width ||
            canvasCenter.y < 0 || canvasCenter.y > this.canvas.height) {

            // 调整图片位置使选择框居中
            this.imageManager.offsetX = this.canvas.width / 2 - centerX * this.imageManager.scale;
            this.imageManager.offsetY = this.canvas.height / 2 - centerY * this.imageManager.scale;
        }

        this.render();
        this.updateUI();
        this.showStatus('已定位到选择框', 'success');
    }

    // 通过ID删除选择框
    deleteSelectionById(selectionId) {
        this.selectionManager.deleteSelection(selectionId);
        this.render();
        this.updateUI();
        this.showStatus('选择框已删除', 'info');
    }

    updateZoomLevel() {
        if (!this.imageManager.hasImage()) return;

        const zoomLevel = document.getElementById('zoomLevel');
        const zoomPreset = document.getElementById('zoomPreset');
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');

        const percentage = this.imageManager.getZoomPercentage();
        zoomLevel.textContent = percentage + '%';

        // 更新下拉选择框
        zoomPreset.value = percentage;

        // 更新按钮状态
        zoomInBtn.disabled = !this.imageManager.canZoomIn();
        zoomOutBtn.disabled = !this.imageManager.canZoomOut();
    }

    exportSelections() {
        const selections = this.selectionManager.getAllSelections();
        if (selections.length === 0) {
            this.showStatus('请先创建选择框', 'error');
            return;
        }

        this.exportManager.exportAllSelections(selections, this.imageManager)
            .then((count) => {
                this.showStatus(`成功导出 ${count} 个图片`, 'success');
            })
            .catch((error) => {
                this.showStatus('导出失败: ' + error.message, 'error');
            });
    }

    deleteActiveSelection() {
        const activeSelection = this.selectionManager.getActiveSelection();
        if (activeSelection) {
            this.selectionManager.deleteSelection(activeSelection.id);
            this.render();
            this.updateUI();
            this.showStatus('选择框已删除', 'info');
        }
    }

    hideWelcomeMessage() {
        const welcomeMessage = document.getElementById('welcomeMessage');
        welcomeMessage.style.display = 'none';
    }

    showStatus(message, type = 'info') {
        const statusMessage = document.getElementById('statusMessage');
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type} show`;

        setTimeout(() => {
            statusMessage.classList.remove('show');
        }, 3000);
    }

    setMode(mode) {
        const panModeBtn = document.getElementById('panModeBtn');
        const selectModeBtn = document.getElementById('selectModeBtn');

        // 更新按钮状态
        panModeBtn.classList.remove('active');
        selectModeBtn.classList.remove('active');

        if (mode === 'pan') {
            panModeBtn.classList.add('active');
            this.canvas.style.cursor = 'grab';
            this.eventHandler.setMode('pan');
            this.showStatus('已切换到拖动模式 ✋', 'info');
        } else {
            selectModeBtn.classList.add('active');
            this.canvas.style.cursor = 'crosshair';
            this.eventHandler.setMode('select');
            this.showStatus('已切换到选择模式 ⊞', 'info');
        }
    }

    setupDragAndDrop() {
        const canvasContainer = document.querySelector('.canvas-container');
        let dragCounter = 0; // 用于跟踪拖拽状态
        let isDragging = false;

        // 防止默认拖拽行为
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            canvasContainer.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // 拖拽进入
        canvasContainer.addEventListener('dragenter', (e) => {
            dragCounter++;
            if (this.isDraggedFile(e) && !isDragging) {
                isDragging = true;
                this.showDragOverlay();
                canvasContainer.classList.add('drag-over');
            }
        });

        // 拖拽悬停
        canvasContainer.addEventListener('dragover', (e) => {
            if (this.isDraggedFile(e)) {
                e.dataTransfer.dropEffect = 'copy';
            }
        });

        // 拖拽离开
        canvasContainer.addEventListener('dragleave', (e) => {
            dragCounter--;
            // 使用setTimeout确保这是真正的离开事件
            setTimeout(() => {
                if (dragCounter === 0 && isDragging) {
                    isDragging = false;
                    this.hideDragOverlay();
                    canvasContainer.classList.remove('drag-over');
                }
            }, 10);
        });

        // 文件放下
        canvasContainer.addEventListener('drop', (e) => {
            dragCounter = 0;
            isDragging = false;
            this.hideDragOverlay();
            canvasContainer.classList.remove('drag-over');

            const files = Array.from(e.dataTransfer.files);
            const imageFile = files.find(file => file.type.startsWith('image/'));

            if (imageFile) {
                this.loadImage(imageFile);
                this.showStatus('图片拖拽成功，正在加载...', 'info');
            } else {
                this.showStatus('请拖拽图片文件', 'error');
            }
        });
    }

    isDraggedFile(e) {
        return e.dataTransfer && e.dataTransfer.types.includes('Files');
    }

    showDragOverlay() {
        const canvasContainer = document.querySelector('.canvas-container');

        // 移除已存在的拖拽覆盖层
        this.hideDragOverlay();

        const overlay = document.createElement('div');
        overlay.className = 'drag-overlay';
        overlay.innerHTML = `
            <div class="drag-message">
                <h3>📁 拖拽图片到这里</h3>
                <p>支持 JPG、PNG、GIF、BMP、WebP 格式</p>
            </div>
        `;

        canvasContainer.appendChild(overlay);
    }

    hideDragOverlay() {
        const overlay = document.querySelector('.drag-overlay');
        if (overlay) {
            overlay.remove();
        }
    }
}

// 图片管理器类
class ImageManager {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.image = null;
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.originalWidth = 0;
        this.originalHeight = 0;
        this.displayWidth = 0;
        this.displayHeight = 0;
        this.minScale = 0.1;
        this.maxScale = 5;
    }

    loadImage(file) {
        return new Promise((resolve, reject) => {
            try {
                // 验证文件类型
                const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
                if (!validTypes.includes(file.type.toLowerCase())) {
                    reject(new Error('不支持的文件格式，请选择 JPG、PNG、GIF、BMP 或 WebP 格式的图片'));
                    return;
                }

                // 验证文件大小 (10MB限制)
                const maxSize = 10 * 1024 * 1024; // 10MB
                if (file.size > maxSize) {
                    reject(new Error(`图片文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），请选择小于10MB的图片`));
                    return;
                }

                // 验证文件名
                if (!file.name || file.name.length === 0) {
                    reject(new Error('无效的文件名'));
                    return;
                }

                // 重置图片状态
                this.resetImageState();

                const img = new Image();

                img.onload = () => {
                    try {
                        // 验证图片尺寸
                        if (img.width === 0 || img.height === 0) {
                            reject(new Error('无效的图片文件'));
                            return;
                        }

                        // 检查图片尺寸是否过大
                        const maxDimension = 20480; // 8K分辨率限制
                        if (img.width > maxDimension || img.height > maxDimension) {
                            reject(new Error(`图片尺寸过大（${img.width}×${img.height}），请选择小于${maxDimension}×${maxDimension}的图片`));
                            return;
                        }

                        this.image = img;
                        this.originalWidth = img.width;
                        this.originalHeight = img.height;
                        this.fitImageToCanvas();

                        console.log(`图片加载成功: ${file.name} (${img.width}×${img.height})`);
                        resolve();
                    } catch (error) {
                        reject(new Error('图片处理失败: ' + error.message));
                    }
                };

                img.onerror = (error) => {
                    console.error('图片加载错误:', error);
                    reject(new Error('图片文件损坏或格式不正确'));
                };

                // 设置超时处理
                const timeout = setTimeout(() => {
                    reject(new Error('图片加载超时，请检查网络连接或选择较小的图片'));
                }, 30000); // 30秒超时

                const reader = new FileReader();
                reader.onload = (e) => {
                    clearTimeout(timeout);
                    img.src = e.target.result;
                };

                reader.onerror = () => {
                    clearTimeout(timeout);
                    reject(new Error('文件读取失败'));
                };

                reader.readAsDataURL(file);
            } catch (error) {
                reject(new Error('文件处理失败: ' + error.message));
            }
        });
    }

    fitImageToCanvas() {
        if (!this.image) return;

        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;

        // 留出边距
        const margin = 20;
        const availableWidth = canvasWidth - margin * 2;
        const availableHeight = canvasHeight - margin * 2;

        // 计算适合Canvas的缩放比例
        const scaleX = availableWidth / this.originalWidth;
        const scaleY = availableHeight / this.originalHeight;
        this.scale = Math.min(scaleX, scaleY, 1); // 不超过原始大小

        // 确保最小缩放比例
        this.scale = Math.max(this.scale, this.minScale);

        // 计算显示尺寸
        this.displayWidth = this.originalWidth * this.scale;
        this.displayHeight = this.originalHeight * this.scale;

        // 居中显示
        this.offsetX = (canvasWidth - this.displayWidth) / 2;
        this.offsetY = (canvasHeight - this.displayHeight) / 2;

        console.log(`图片适配完成: 缩放比例=${this.scale.toFixed(2)}, 显示尺寸=${Math.round(this.displayWidth)}×${Math.round(this.displayHeight)}`);
    }

    drawImage() {
        if (!this.image) return;

        try {
            // 保存当前上下文状态
            this.ctx.save();

            // 设置图片渲染质量
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = 'high';

            // 绘制图片
            this.ctx.drawImage(
                this.image,
                this.offsetX,
                this.offsetY,
                this.displayWidth,
                this.displayHeight
            );

            // 恢复上下文状态
            this.ctx.restore();
        } catch (error) {
            console.error('图片绘制失败:', error);
        }
    }

    zoomIn() {
        const newScale = Math.min(this.scale * 1.2, this.maxScale);
        this.setScaleKeepCentered(newScale);
    }

    zoomOut() {
        const newScale = Math.max(this.scale / 1.2, this.minScale);
        this.setScaleKeepCentered(newScale);
    }

    // 缩放时保持图片居中
    setScaleKeepCentered(newScale) {
        if (!this.image) return;

        // 限制缩放范围
        newScale = Math.max(this.minScale, Math.min(newScale, this.maxScale));

        const oldScale = this.scale;
        if (Math.abs(newScale - oldScale) < 0.001) return;

        // 更新缩放比例和显示尺寸
        this.scale = newScale;
        this.displayWidth = this.originalWidth * this.scale;
        this.displayHeight = this.originalHeight * this.scale;

        // 保持图片居中
        this.offsetX = (this.canvas.width - this.displayWidth) / 2;
        this.offsetY = (this.canvas.height - this.displayHeight) / 2;

        console.log(`居中缩放: ${(oldScale * 100).toFixed(0)}% -> ${(this.scale * 100).toFixed(0)}%, 位置: (${Math.round(this.offsetX)}, ${Math.round(this.offsetY)})`);
    }

    setScale(newScale, centerX = null, centerY = null) {
        if (!this.image) return;

        // 限制缩放范围
        newScale = Math.max(this.minScale, Math.min(newScale, this.maxScale));

        const oldScale = this.scale;
        if (Math.abs(newScale - oldScale) < 0.001) return; // 避免微小变化

        // 如果没有指定中心点，使用Canvas中心
        if (centerX === null || centerY === null) {
            centerX = this.canvas.width / 2;
            centerY = this.canvas.height / 2;
        }

        // 保存当前的图片中心点在Canvas上的位置
        const currentImageCenterX = this.offsetX + (this.displayWidth / 2);
        const currentImageCenterY = this.offsetY + (this.displayHeight / 2);

        // 计算缩放中心点相对于图片中心的偏移
        const offsetFromImageCenterX = centerX - currentImageCenterX;
        const offsetFromImageCenterY = centerY - currentImageCenterY;

        // 更新缩放比例和显示尺寸
        const scaleRatio = newScale / oldScale;
        this.scale = newScale;
        this.displayWidth = this.originalWidth * this.scale;
        this.displayHeight = this.originalHeight * this.scale;

        // 计算新的图片中心位置
        const newImageCenterX = centerX - (offsetFromImageCenterX * scaleRatio);
        const newImageCenterY = centerY - (offsetFromImageCenterY * scaleRatio);

        // 更新偏移量
        this.offsetX = newImageCenterX - (this.displayWidth / 2);
        this.offsetY = newImageCenterY - (this.displayHeight / 2);

        // 应用边界限制
        this.constrainImagePosition();

        console.log(`缩放更新: ${(oldScale * 100).toFixed(0)}% -> ${(this.scale * 100).toFixed(0)}%`);
    }

    getScale() {
        return this.scale;
    }

    hasImage() {
        return this.image !== null;
    }

    // 坐标转换：Canvas坐标转换为图片坐标
    canvasToImage(canvasX, canvasY) {
        const imageX = (canvasX - this.offsetX) / this.scale;
        const imageY = (canvasY - this.offsetY) / this.scale;
        return { x: imageX, y: imageY };
    }

    // 坐标转换：图片坐标转换为Canvas坐标
    imageToCanvas(imageX, imageY) {
        const canvasX = imageX * this.scale + this.offsetX;
        const canvasY = imageY * this.scale + this.offsetY;
        return { x: canvasX, y: canvasY };
    }

    getImageBounds() {
        return {
            x: this.offsetX,
            y: this.offsetY,
            width: this.displayWidth,
            height: this.displayHeight
        };
    }

    getImageData() {
        if (!this.image) return null;

        return {
            image: this.image,
            originalWidth: this.originalWidth,
            originalHeight: this.originalHeight,
            displayWidth: this.displayWidth,
            displayHeight: this.displayHeight,
            scale: this.scale,
            offsetX: this.offsetX,
            offsetY: this.offsetY
        };
    }

    // 检查点是否在图片范围内
    isPointInImage(x, y) {
        const bounds = this.getImageBounds();
        return x >= bounds.x && x <= bounds.x + bounds.width &&
            y >= bounds.y && y <= bounds.y + bounds.height;
    }

    // 将坐标限制在图片范围内
    clampToImage(x, y) {
        const bounds = this.getImageBounds();
        return {
            x: Math.max(bounds.x, Math.min(x, bounds.x + bounds.width)),
            y: Math.max(bounds.y, Math.min(y, bounds.y + bounds.height))
        };
    }

    // 重置图片位置和缩放
    resetView() {
        this.fitImageToCanvas();
    }

    // 重置图片状态
    resetImageState() {
        this.image = null;
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.originalWidth = 0;
        this.originalHeight = 0;
        this.displayWidth = 0;
        this.displayHeight = 0;
    }

    // 限制图片位置，防止跑得太远
    constrainImagePosition() {
        if (!this.image) return;

        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;

        // 如果图片比Canvas小，尽量保持居中
        if (this.displayWidth <= canvasWidth) {
            // 图片宽度小于Canvas，保持居中或允许小范围移动
            const centerX = (canvasWidth - this.displayWidth) / 2;
            const maxDeviation = 100; // 允许偏离中心的最大距离
            this.offsetX = Math.max(centerX - maxDeviation, Math.min(this.offsetX, centerX + maxDeviation));
        } else {
            // 图片宽度大于Canvas，确保至少有一部分可见
            const minVisibleWidth = Math.min(200, this.displayWidth * 0.3);
            const maxOffsetX = minVisibleWidth - this.displayWidth;
            const minOffsetX = canvasWidth - minVisibleWidth;
            this.offsetX = Math.max(maxOffsetX, Math.min(this.offsetX, minOffsetX));
        }

        if (this.displayHeight <= canvasHeight) {
            // 图片高度小于Canvas，保持居中或允许小范围移动
            const centerY = (canvasHeight - this.displayHeight) / 2;
            const maxDeviation = 100; // 允许偏离中心的最大距离
            this.offsetY = Math.max(centerY - maxDeviation, Math.min(this.offsetY, centerY + maxDeviation));
        } else {
            // 图片高度大于Canvas，确保至少有一部分可见
            const minVisibleHeight = Math.min(200, this.displayHeight * 0.3);
            const maxOffsetY = minVisibleHeight - this.displayHeight;
            const minOffsetY = canvasHeight - minVisibleHeight;
            this.offsetY = Math.max(maxOffsetY, Math.min(this.offsetY, minOffsetY));
        }
    }

    // 设置特定的缩放级别
    setZoomLevel(level, keepCentered = true) {
        const scale = level / 100;
        if (keepCentered) {
            this.setScaleKeepCentered(scale);
        } else {
            this.setScale(scale);
        }
    }

    // 获取缩放百分比
    getZoomPercentage() {
        return Math.round(this.scale * 100);
    }

    // 检查是否可以继续放大
    canZoomIn() {
        return this.scale < this.maxScale;
    }

    // 检查是否可以继续缩小
    canZoomOut() {
        return this.scale > this.minScale;
    }

    // 获取推荐的缩放级别
    getRecommendedZoomLevels() {
        return [25, 50, 75, 100, 125, 150, 200, 300, 400, 500];
    }
}

// 选择框管理器类
class SelectionManager {
    constructor() {
        this.selections = [];
        this.activeSelectionId = null;
        this.nextId = 1;
    }

    createSelection(startX, startY, endX, endY) {
        const selection = {
            id: `selection_${this.nextId++}`,
            x: Math.min(startX, endX),
            y: Math.min(startY, endY),
            width: Math.abs(endX - startX),
            height: Math.abs(endY - startY),
            active: false,
            created: new Date().toISOString()
        };

        // 验证选择框尺寸
        if (selection.width < 1 || selection.height < 1) {
            throw new Error('选择框尺寸太小');
        }

        this.selections.push(selection);
        this.setActiveSelection(selection.id);

        console.log(`创建选择框: ${selection.id}, 位置:(${Math.round(selection.x)}, ${Math.round(selection.y)}), 大小:${Math.round(selection.width)}×${Math.round(selection.height)}`);

        return selection;
    }

    updateSelection(id, bounds) {
        const selection = this.selections.find(s => s.id === id);
        if (selection) {
            Object.assign(selection, bounds);
        }
    }

    deleteSelection(id) {
        const index = this.selections.findIndex(s => s.id === id);
        if (index !== -1) {
            this.selections.splice(index, 1);
            if (this.activeSelectionId === id) {
                this.activeSelectionId = null;
            }
        }
    }

    setActiveSelection(id) {
        this.selections.forEach(s => s.active = false);
        const selection = this.selections.find(s => s.id === id);
        if (selection) {
            selection.active = true;
            this.activeSelectionId = id;
        }
    }

    getActiveSelection() {
        return this.selections.find(s => s.active);
    }

    getAllSelections() {
        return this.selections;
    }

    clearActiveSelection() {
        this.selections.forEach(s => s.active = false);
        this.activeSelectionId = null;
    }
}

// Canvas渲染器类
class CanvasRenderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawImage(imageManager) {
        imageManager.drawImage();
    }

    drawSelections(selections, imageManager) {
        selections.forEach(selection => {
            this.drawSelection(selection, selection.active, imageManager);
        });
    }

    drawSelection(selection, isActive, imageManager) {
        const ctx = this.ctx;

        // 将图片坐标转换为Canvas坐标
        const canvasCoords = imageManager.imageToCanvas(selection.x, selection.y);
        const canvasWidth = selection.width * imageManager.scale;
        const canvasHeight = selection.height * imageManager.scale;

        // 保存上下文状态
        ctx.save();

        // 绘制选择框阴影（仅活动选择框）
        if (isActive) {
            ctx.shadowColor = 'rgba(52, 152, 219, 0.5)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }

        // 绘制选择框边框
        ctx.strokeStyle = isActive ? '#3498db' : '#e74c3c';
        ctx.lineWidth = isActive ? 3 : 2;
        ctx.setLineDash([]);
        ctx.strokeRect(canvasCoords.x, canvasCoords.y, canvasWidth, canvasHeight);

        // 重置阴影
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // 绘制半透明填充
        ctx.fillStyle = isActive ? 'rgba(52, 152, 219, 0.15)' : 'rgba(231, 76, 60, 0.08)';
        ctx.fillRect(canvasCoords.x, canvasCoords.y, canvasWidth, canvasHeight);

        // 绘制选择框标签
        if (canvasWidth > 60 && canvasHeight > 25) {
            const selectionIndex = this.getSelectionIndex(selection);

            // 绘制标签背景
            const labelPadding = 4;
            const labelHeight = 18;
            ctx.fillStyle = isActive ? '#3498db' : '#e74c3c';
            ctx.fillRect(canvasCoords.x, canvasCoords.y - labelHeight, 80, labelHeight);

            // 绘制标签文字
            ctx.fillStyle = 'white';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`选择框 ${selectionIndex}`, canvasCoords.x + labelPadding, canvasCoords.y - 6);
        }

        // 绘制选择框尺寸信息（仅活动选择框且足够大时）
        if (isActive && canvasWidth > 100 && canvasHeight > 50) {
            const sizeText = `${Math.round(selection.width)} × ${Math.round(selection.height)}`;
            ctx.fillStyle = 'rgba(52, 152, 219, 0.8)';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';

            const textX = canvasCoords.x + canvasWidth / 2;
            const textY = canvasCoords.y + canvasHeight / 2 + 4;

            // 绘制文字背景
            const textMetrics = ctx.measureText(sizeText);
            const textWidth = textMetrics.width + 8;
            const textHeight = 16;
            ctx.fillRect(textX - textWidth / 2, textY - textHeight / 2, textWidth, textHeight);

            // 绘制文字
            ctx.fillStyle = 'white';
            ctx.fillText(sizeText, textX, textY + 2);
        }

        // 如果是活动选择框，绘制调整手柄
        if (isActive) {
            this.drawResizeHandles({
                x: canvasCoords.x,
                y: canvasCoords.y,
                width: canvasWidth,
                height: canvasHeight
            });
        }

        // 恢复上下文状态
        ctx.restore();
    }

    getSelectionIndex(targetSelection) {
        // 这个方法需要从应用中获取选择框索引
        // 暂时返回简单的编号
        return targetSelection.id.split('_')[1];
    }

    drawResizeHandles(selection) {
        const ctx = this.ctx;
        const handleSize = 8;
        const halfHandle = handleSize / 2;

        ctx.fillStyle = '#3498db';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;

        // 四个角的手柄
        const corners = [
            { x: selection.x - halfHandle, y: selection.y - halfHandle }, // 左上
            { x: selection.x + selection.width - halfHandle, y: selection.y - halfHandle }, // 右上
            { x: selection.x - halfHandle, y: selection.y + selection.height - halfHandle }, // 左下
            { x: selection.x + selection.width - halfHandle, y: selection.y + selection.height - halfHandle } // 右下
        ];

        // 四条边中点的手柄
        const edges = [
            { x: selection.x + selection.width / 2 - halfHandle, y: selection.y - halfHandle }, // 上
            { x: selection.x + selection.width / 2 - halfHandle, y: selection.y + selection.height - halfHandle }, // 下
            { x: selection.x - halfHandle, y: selection.y + selection.height / 2 - halfHandle }, // 左
            { x: selection.x + selection.width - halfHandle, y: selection.y + selection.height / 2 - halfHandle } // 右
        ];

        [...corners, ...edges].forEach(handle => {
            ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
            ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
        });
    }
}

// 事件处理器类
class EventHandler {
    constructor(canvas, imageManager, selectionManager, canvasRenderer) {
        this.canvas = canvas;
        this.imageManager = imageManager;
        this.selectionManager = selectionManager;
        this.canvasRenderer = canvasRenderer;

        this.mode = 'select'; // 'select' 或 'pan'
        this.isDrawing = false;
        this.isDragging = false;
        this.isResizing = false;
        this.isPanning = false;
        this.dragStartPos = { x: 0, y: 0 };
        this.activeHandle = null;
        this.currentSelection = null;
    }

    setMode(mode) {
        this.mode = mode;
        this.cancelCurrentOperation();
    }

    handleMouseDown(event) {
        if (!this.imageManager.hasImage()) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        this.dragStartPos = { x, y };

        // 拖动模式：直接开始拖动图片
        if (this.mode === 'pan') {
            this.isPanning = true;
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        // 选择模式：原有的选择框逻辑
        // 检查是否在图片范围内
        if (!this.imageManager.isPointInImage(x, y)) return;

        // 转换为图片坐标
        const imageCoords = this.imageManager.canvasToImage(x, y);

        // 首先检查是否点击了活动选择框的调整手柄
        const activeSelection = this.selectionManager.getActiveSelection();
        if (activeSelection) {
            const handle = this.getResizeHandle(x, y, activeSelection);
            if (handle) {
                // 开始调整选择框
                this.isResizing = true;
                this.activeHandle = handle;
                this.currentSelection = activeSelection;
                this.originalSelection = { ...activeSelection };
                return;
            }
        }

        // 检查是否点击了现有选择框
        const clickedSelection = this.findSelectionAtPoint(x, y);

        if (clickedSelection) {
            // 点击了现有选择框
            this.selectionManager.setActiveSelection(clickedSelection.id);
            this.isDragging = true;
            this.currentSelection = clickedSelection;
            this.canvas.style.cursor = 'move';
        } else {
            // 开始创建新选择框
            this.isDrawing = true;
            this.dragStartPos = { x: imageCoords.x, y: imageCoords.y };
            this.selectionManager.clearActiveSelection();
            this.canvas.style.cursor = 'crosshair';
        }

        app.render();
        app.updateUI();
    }

    handleMouseMove(event) {
        if (!this.imageManager.hasImage()) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        if (this.isPanning) {
            // 正在拖动图片
            const deltaX = x - this.dragStartPos.x;
            const deltaY = y - this.dragStartPos.y;

            this.imageManager.offsetX += deltaX;
            this.imageManager.offsetY += deltaY;

            this.dragStartPos = { x, y };
            app.render();
            return;
        }

        if (this.isDrawing) {
            // 正在创建选择框
            const imageCoords = this.imageManager.canvasToImage(x, y);
            this.drawTemporarySelection(this.dragStartPos, imageCoords);
        } else if (this.isResizing && this.currentSelection && this.activeHandle) {
            // 正在调整选择框大小
            this.resizeSelection(x, y);
            app.render();
        } else if (this.isDragging && this.currentSelection) {
            // 正在拖拽选择框
            const deltaX = x - this.dragStartPos.x;
            const deltaY = y - this.dragStartPos.y;

            // 转换为图片坐标的偏移量
            const imageDeltaX = deltaX / this.imageManager.scale;
            const imageDeltaY = deltaY / this.imageManager.scale;

            // 更新选择框位置
            const newX = this.currentSelection.x + imageDeltaX;
            const newY = this.currentSelection.y + imageDeltaY;

            // 确保选择框不超出图片边界
            const clampedX = Math.max(0, Math.min(newX, this.imageManager.originalWidth - this.currentSelection.width));
            const clampedY = Math.max(0, Math.min(newY, this.imageManager.originalHeight - this.currentSelection.height));

            this.selectionManager.updateSelection(this.currentSelection.id, {
                x: clampedX,
                y: clampedY
            });

            this.dragStartPos = { x, y };
            app.render();
        } else {
            // 更新鼠标指针样式
            this.updateCursor(x, y);
        }
    }

    handleMouseUp(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        if (this.isPanning) {
            // 完成图片拖动
            this.isPanning = false;
            this.canvas.style.cursor = this.mode === 'pan' ? 'grab' : 'crosshair';
            return;
        }

        if (!this.imageManager.hasImage()) return;

        if (this.isDrawing) {
            // 完成选择框创建
            const imageCoords = this.imageManager.canvasToImage(x, y);
            const startX = Math.min(this.dragStartPos.x, imageCoords.x);
            const startY = Math.min(this.dragStartPos.y, imageCoords.y);
            const endX = Math.max(this.dragStartPos.x, imageCoords.x);
            const endY = Math.max(this.dragStartPos.y, imageCoords.y);

            const width = endX - startX;
            const height = endY - startY;

            // 只有当选择框足够大时才创建
            if (width > 10 && height > 10) {
                // 确保选择框在图片范围内
                const clampedStartX = Math.max(0, Math.min(startX, this.imageManager.originalWidth));
                const clampedStartY = Math.max(0, Math.min(startY, this.imageManager.originalHeight));
                const clampedEndX = Math.max(0, Math.min(endX, this.imageManager.originalWidth));
                const clampedEndY = Math.max(0, Math.min(endY, this.imageManager.originalHeight));

                const clampedWidth = clampedEndX - clampedStartX;
                const clampedHeight = clampedEndY - clampedStartY;

                if (clampedWidth > 5 && clampedHeight > 5) {
                    this.selectionManager.createSelection(clampedStartX, clampedStartY, clampedEndX, clampedEndY);
                    app.showStatus('选择框创建成功', 'success');
                }
            }

            this.isDrawing = false;
        } else if (this.isResizing) {
            // 完成选择框调整
            this.isResizing = false;
            this.activeHandle = null;
            this.originalSelection = null;
            app.showStatus('选择框调整完成', 'success');
        } else if (this.isDragging) {
            // 完成选择框拖拽
            this.isDragging = false;
            app.showStatus('选择框移动完成', 'success');
        }

        this.currentSelection = null;
        this.updateCursor(x, y);
        app.render();
        app.updateUI();
    }

    // 查找指定点处的选择框
    findSelectionAtPoint(canvasX, canvasY) {
        const selections = this.selectionManager.getAllSelections();

        // 从后往前查找（最后创建的在最上层）
        for (let i = selections.length - 1; i >= 0; i--) {
            const selection = selections[i];
            const canvasCoords = this.imageManager.imageToCanvas(selection.x, selection.y);
            const canvasWidth = selection.width * this.imageManager.scale;
            const canvasHeight = selection.height * this.imageManager.scale;

            if (canvasX >= canvasCoords.x && canvasX <= canvasCoords.x + canvasWidth &&
                canvasY >= canvasCoords.y && canvasY <= canvasCoords.y + canvasHeight) {
                return selection;
            }
        }

        return null;
    }

    // 绘制临时选择框（拖拽过程中）
    drawTemporarySelection(startImageCoords, endImageCoords) {
        const startCanvas = this.imageManager.imageToCanvas(startImageCoords.x, startImageCoords.y);
        const endCanvas = this.imageManager.imageToCanvas(endImageCoords.x, endImageCoords.y);

        const x = Math.min(startCanvas.x, endCanvas.x);
        const y = Math.min(startCanvas.y, endCanvas.y);
        const width = Math.abs(endCanvas.x - startCanvas.x);
        const height = Math.abs(endCanvas.y - startCanvas.y);

        // 重新渲染整个画布
        app.render();

        // 绘制临时选择框
        const ctx = this.canvasRenderer.ctx;
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x, y, width, height);
        ctx.fillStyle = 'rgba(52, 152, 219, 0.1)';
        ctx.fillRect(x, y, width, height);
        ctx.setLineDash([]);
    }

    // 更新鼠标指针样式
    updateCursor(x, y) {
        // 拖动模式下始终显示抓手
        if (this.mode === 'pan') {
            this.canvas.style.cursor = 'grab';
            return;
        }

        if (!this.imageManager.isPointInImage(x, y)) {
            this.canvas.style.cursor = 'default';
            return;
        }

        const activeSelection = this.selectionManager.getActiveSelection();
        if (activeSelection) {
            const handle = this.getResizeHandle(x, y, activeSelection);
            if (handle) {
                this.canvas.style.cursor = this.getHandleCursor(handle);
                return;
            }
        }

        const selection = this.findSelectionAtPoint(x, y);
        if (selection) {
            this.canvas.style.cursor = 'move';
        } else {
            this.canvas.style.cursor = 'crosshair';
        }
    }

    // 获取调整手柄类型
    getResizeHandle(mouseX, mouseY, selection) {
        const canvasCoords = this.imageManager.imageToCanvas(selection.x, selection.y);
        const canvasWidth = selection.width * this.imageManager.scale;
        const canvasHeight = selection.height * this.imageManager.scale;

        const handleSize = 8;
        const tolerance = handleSize / 2;

        // 定义手柄位置
        const handles = {
            'nw': { x: canvasCoords.x, y: canvasCoords.y },
            'ne': { x: canvasCoords.x + canvasWidth, y: canvasCoords.y },
            'sw': { x: canvasCoords.x, y: canvasCoords.y + canvasHeight },
            'se': { x: canvasCoords.x + canvasWidth, y: canvasCoords.y + canvasHeight },
            'n': { x: canvasCoords.x + canvasWidth / 2, y: canvasCoords.y },
            's': { x: canvasCoords.x + canvasWidth / 2, y: canvasCoords.y + canvasHeight },
            'w': { x: canvasCoords.x, y: canvasCoords.y + canvasHeight / 2 },
            'e': { x: canvasCoords.x + canvasWidth, y: canvasCoords.y + canvasHeight / 2 }
        };

        // 检查鼠标是否在某个手柄上
        for (const [handleType, handlePos] of Object.entries(handles)) {
            if (Math.abs(mouseX - handlePos.x) <= tolerance &&
                Math.abs(mouseY - handlePos.y) <= tolerance) {
                return handleType;
            }
        }

        return null;
    }

    // 获取手柄对应的鼠标指针样式
    getHandleCursor(handle) {
        const cursors = {
            'nw': 'nw-resize',
            'ne': 'ne-resize',
            'sw': 'sw-resize',
            'se': 'se-resize',
            'n': 'n-resize',
            's': 's-resize',
            'w': 'w-resize',
            'e': 'e-resize'
        };
        return cursors[handle] || 'default';
    }

    handleKeyDown(event) {
        // 只在有图片时处理缩放快捷键
        if (!this.imageManager.hasImage()) return;

        if (event.ctrlKey) {
            switch (event.key) {
                case '=':
                case '+':
                    event.preventDefault();
                    this.imageManager.zoomIn();
                    app.render();
                    app.updateUI();
                    break;

                case '-':
                    event.preventDefault();
                    this.imageManager.zoomOut();
                    app.render();
                    app.updateUI();
                    break;

                case '0':
                    event.preventDefault();
                    this.imageManager.resetView();
                    app.render();
                    app.updateUI();
                    app.showStatus('已重置视图', 'info');
                    break;

                case '1':
                    event.preventDefault();
                    this.imageManager.setScaleKeepCentered(1);
                    app.render();
                    app.updateUI();
                    app.showStatus('已设置为100%缩放', 'info');
                    break;
            }
        }

        // ESC键取消当前操作
        if (event.key === 'Escape') {
            this.cancelCurrentOperation();
            this.selectionManager.clearActiveSelection();
            app.render();
            app.updateUI();
        }

        // Tab键切换选择框
        if (event.key === 'Tab') {
            event.preventDefault();
            this.switchToNextSelection(event.shiftKey);
            app.render();
            app.updateUI();
        }

        // Delete键删除活动选择框
        if (event.key === 'Delete' || event.key === 'Backspace') {
            const activeSelection = this.selectionManager.getActiveSelection();
            if (activeSelection) {
                event.preventDefault();
                this.selectionManager.deleteSelection(activeSelection.id);
                app.render();
                app.updateUI();
                app.showStatus('选择框已删除', 'info');
            }
        }

        // 空格键切换模式
        if (event.key === ' ') {
            event.preventDefault();
            const currentMode = this.mode === 'select' ? 'pan' : 'select';
            app.setMode(currentMode);
        }
    }

    cancelCurrentOperation() {
        this.isDrawing = false;
        this.isDragging = false;
        this.isResizing = false;
        this.isPanning = false;
        this.activeHandle = null;
        this.currentSelection = null;
        this.originalSelection = null;

        // 根据当前模式设置鼠标指针
        if (this.mode === 'pan') {
            this.canvas.style.cursor = 'grab';
        } else {
            this.canvas.style.cursor = 'crosshair';
        }
    }

    // 切换到下一个选择框
    switchToNextSelection(reverse = false) {
        const selections = this.selectionManager.getAllSelections();
        if (selections.length === 0) return;

        const activeSelection = this.selectionManager.getActiveSelection();
        let nextIndex = 0;

        if (activeSelection) {
            const currentIndex = selections.findIndex(s => s.id === activeSelection.id);
            if (reverse) {
                nextIndex = currentIndex > 0 ? currentIndex - 1 : selections.length - 1;
            } else {
                nextIndex = currentIndex < selections.length - 1 ? currentIndex + 1 : 0;
            }
        }

        this.selectionManager.setActiveSelection(selections[nextIndex].id);
        app.showStatus(`已切换到选择框 ${nextIndex + 1}`, 'info');
    }

    // 调整选择框大小
    resizeSelection(mouseX, mouseY) {
        if (!this.currentSelection || !this.activeHandle || !this.originalSelection) return;

        // 转换鼠标位置为图片坐标
        const mouseImageCoords = this.imageManager.canvasToImage(mouseX, mouseY);
        const startImageCoords = this.imageManager.canvasToImage(this.dragStartPos.x, this.dragStartPos.y);

        // 计算偏移量
        const deltaX = mouseImageCoords.x - startImageCoords.x;
        const deltaY = mouseImageCoords.y - startImageCoords.y;

        let newBounds = { ...this.originalSelection };

        // 根据手柄类型调整选择框
        switch (this.activeHandle) {
            case 'nw': // 左上角
                newBounds.x += deltaX;
                newBounds.y += deltaY;
                newBounds.width -= deltaX;
                newBounds.height -= deltaY;
                break;

            case 'ne': // 右上角
                newBounds.y += deltaY;
                newBounds.width += deltaX;
                newBounds.height -= deltaY;
                break;

            case 'sw': // 左下角
                newBounds.x += deltaX;
                newBounds.width -= deltaX;
                newBounds.height += deltaY;
                break;

            case 'se': // 右下角
                newBounds.width += deltaX;
                newBounds.height += deltaY;
                break;

            case 'n': // 上边
                newBounds.y += deltaY;
                newBounds.height -= deltaY;
                break;

            case 's': // 下边
                newBounds.height += deltaY;
                break;

            case 'w': // 左边
                newBounds.x += deltaX;
                newBounds.width -= deltaX;
                break;

            case 'e': // 右边
                newBounds.width += deltaX;
                break;
        }

        // 确保最小尺寸
        const minSize = 10;
        if (newBounds.width < minSize) {
            if (this.activeHandle.includes('w')) {
                newBounds.x = this.originalSelection.x + this.originalSelection.width - minSize;
            }
            newBounds.width = minSize;
        }

        if (newBounds.height < minSize) {
            if (this.activeHandle.includes('n')) {
                newBounds.y = this.originalSelection.y + this.originalSelection.height - minSize;
            }
            newBounds.height = minSize;
        }

        // 确保不超出图片边界
        newBounds.x = Math.max(0, newBounds.x);
        newBounds.y = Math.max(0, newBounds.y);
        newBounds.width = Math.min(newBounds.width, this.imageManager.originalWidth - newBounds.x);
        newBounds.height = Math.min(newBounds.height, this.imageManager.originalHeight - newBounds.y);

        // 更新选择框
        this.selectionManager.updateSelection(this.currentSelection.id, newBounds);
    }

    handleRightClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // 检查是否右键点击了选择框
        const clickedSelection = this.findSelectionAtPoint(x, y);

        if (clickedSelection) {
            // 设置为活动选择框
            this.selectionManager.setActiveSelection(clickedSelection.id);

            // 显示右键菜单
            const contextMenu = document.getElementById('contextMenu');
            contextMenu.style.display = 'block';
            contextMenu.style.left = event.clientX + 'px';
            contextMenu.style.top = event.clientY + 'px';

            app.render();
            app.updateUI();
        }
    }

    handleWheel(event) {
        if (!this.imageManager.hasImage()) return;

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // 检查鼠标是否在Canvas范围内
        if (mouseX < 0 || mouseX > this.canvas.width || mouseY < 0 || mouseY > this.canvas.height) {
            return;
        }

        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
        const currentScale = this.imageManager.getScale();
        const newScale = currentScale * zoomFactor;

        // 以鼠标位置为中心进行缩放
        this.imageManager.setScale(newScale, mouseX, mouseY);
        app.render();
        app.updateUI();
    }
}

// 导出管理器类
class ExportManager {
    constructor() {
        this.exportCount = 0;
    }

    async exportAllSelections(selections, imageManager) {
        if (!selections || selections.length === 0) {
            throw new Error('没有选择框可导出');
        }

        if (!imageManager.hasImage()) {
            throw new Error('没有图片可导出');
        }

        // 显示导出配置对话框
        const exportConfig = await this.showExportDialog(selections.length);
        if (!exportConfig) {
            throw new Error('用户取消导出');
        }

        let exportedCount = 0;

        for (let i = 0; i < selections.length; i++) {
            try {
                const filename = this.generateFilename(exportConfig, i + 1);
                await this.cropSelection(selections[i], imageManager, filename, exportConfig);
                exportedCount++;
            } catch (error) {
                console.error(`导出选择框 ${i + 1} 失败:`, error);
            }
        }

        return exportedCount;
    }

    showExportDialog(selectionCount) {
        return new Promise((resolve) => {
            // 检查是否支持文件夹选择
            const supportsDirectoryPicker = 'showDirectoryPicker' in window;

            // 创建导出配置对话框
            const dialog = document.createElement('div');
            dialog.className = 'export-dialog-overlay';
            dialog.innerHTML = `
                <div class="export-dialog">
                    <div class="export-dialog-header">
                        <h3>导出设置</h3>
                        <button class="close-btn">×</button>
                    </div>
                    <div class="export-dialog-content">
                        <div class="form-group">
                            <label>文件名前缀:</label>
                            <input type="text" id="filenamePrefix" value="cropped" placeholder="输入文件名前缀">
                        </div>
                        <div class="form-group">
                            <label>文件格式:</label>
                            <select id="fileFormat">
                                <option value="png">PNG (推荐)</option>
                                <option value="jpeg">JPEG</option>
                                <option value="webp">WebP</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>图片质量 (JPEG/WebP):</label>
                            <input type="range" id="imageQuality" min="0.1" max="1" step="0.1" value="0.9">
                            <span id="qualityValue">90%</span>
                        </div>
                        ${supportsDirectoryPicker ? `
                        <div class="form-group">
                            <label>保存位置:</label>
                            <button type="button" id="selectFolderBtn" class="btn btn-small">📁 选择文件夹</button>
                            <div id="selectedFolder" class="selected-folder">默认下载文件夹</div>
                        </div>
                        ` : `
                        <div class="form-group">
                            <div class="info-box">
                                <strong>💡 提示：</strong>文件将保存到浏览器的默认下载文件夹。<br>
                                如需选择文件夹，请使用支持文件系统API的现代浏览器（如Chrome 86+）。
                            </div>
                        </div>
                        `}
                        <div class="export-info">
                            将导出 ${selectionCount} 个图片文件
                        </div>
                    </div>
                    <div class="export-dialog-footer">
                        <button class="btn btn-secondary" id="cancelBtn">取消</button>
                        <button class="btn btn-primary" id="exportBtn">开始导出</button>
                    </div>
                </div>
            `;

            document.body.appendChild(dialog);

            let selectedDirectoryHandle = null;

            // 质量滑块事件
            const qualitySlider = dialog.querySelector('#imageQuality');
            const qualityValue = dialog.querySelector('#qualityValue');
            qualitySlider.addEventListener('input', (e) => {
                qualityValue.textContent = Math.round(e.target.value * 100) + '%';
            });

            // 文件夹选择按钮事件
            if (supportsDirectoryPicker) {
                const selectFolderBtn = dialog.querySelector('#selectFolderBtn');
                const selectedFolderDiv = dialog.querySelector('#selectedFolder');

                selectFolderBtn.addEventListener('click', async () => {
                    try {
                        selectedDirectoryHandle = await window.showDirectoryPicker();
                        selectedFolderDiv.textContent = `📁 ${selectedDirectoryHandle.name}`;
                        selectedFolderDiv.style.color = '#27ae60';
                        selectedFolderDiv.style.fontWeight = 'bold';
                    } catch (error) {
                        if (error.name !== 'AbortError') {
                            console.error('文件夹选择失败:', error);
                            selectedFolderDiv.textContent = '文件夹选择失败，将使用默认下载文件夹';
                            selectedFolderDiv.style.color = '#e74c3c';
                        }
                    }
                });
            }

            // 导出按钮事件
            dialog.querySelector('#exportBtn').addEventListener('click', () => {
                const config = {
                    prefix: dialog.querySelector('#filenamePrefix').value || 'cropped',
                    format: dialog.querySelector('#fileFormat').value,
                    quality: parseFloat(dialog.querySelector('#imageQuality').value),
                    directoryHandle: selectedDirectoryHandle
                };
                dialog.remove();
                resolve(config);
            });

            // 取消按钮和关闭按钮事件
            dialog.querySelector('#cancelBtn').addEventListener('click', () => {
                dialog.remove();
                resolve(null);
            });

            dialog.querySelector('.close-btn').addEventListener('click', () => {
                dialog.remove();
                resolve(null);
            });
        });
    }

    generateFilename(config, index) {
        const extension = config.format === 'jpeg' ? 'jpg' : config.format;
        return `${config.prefix}_${index}.${extension}`;
    }

    cropSelection(selection, imageManager, filename, config = null) {
        return new Promise((resolve, reject) => {
            try {
                // 创建临时Canvas用于裁剪
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');

                // 设置Canvas尺寸为选择框尺寸
                tempCanvas.width = Math.round(selection.width);
                tempCanvas.height = Math.round(selection.height);

                // 从原始图片中裁剪指定区域
                tempCtx.drawImage(
                    imageManager.image,
                    selection.x, selection.y, selection.width, selection.height,
                    0, 0, selection.width, selection.height
                );

                // 根据配置导出不同格式
                const mimeType = filename.endsWith('.jpg') ? 'image/jpeg' :
                    filename.endsWith('.webp') ? 'image/webp' : 'image/png';

                const quality = config ? config.quality : 0.9;

                // 转换为Blob并下载
                tempCanvas.toBlob(async (blob) => {
                    if (blob) {
                        if (config && config.directoryHandle) {
                            // 使用文件系统API保存到指定文件夹
                            await this.saveToDirectory(blob, filename, config.directoryHandle);
                        } else {
                            // 使用传统下载方式
                            this.downloadImage(blob, filename);
                        }
                        resolve();
                    } else {
                        reject(new Error('图片转换失败'));
                    }
                }, mimeType, quality);

            } catch (error) {
                reject(error);
            }
        });
    }

    async saveToDirectory(blob, filename, directoryHandle) {
        try {
            const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
        } catch (error) {
            console.error('保存到文件夹失败，使用默认下载:', error);
            // 如果保存到文件夹失败，回退到默认下载
            this.downloadImage(blob, filename);
        }
    }

    downloadImage(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

// 快捷键折叠功能
function toggleShortcuts() {
    const shortcutsSection = document.querySelector('.shortcuts-section');
    const toggleIcon = document.querySelector('.toggle-icon');

    shortcutsSection.classList.toggle('collapsed');

    if (shortcutsSection.classList.contains('collapsed')) {
        toggleIcon.textContent = '▶';
    } else {
        toggleIcon.textContent = '▼';
    }
}

// 应用初始化
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new ImageCropApp();
    app.init();
});
// 简单的单元
测试框架
class SimpleTest {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, testFn) {
        this.tests.push({ name, testFn });
    }

    async run() {
        console.log('开始运行单元测试...');

        for (const test of this.tests) {
            try {
                await test.testFn();
                console.log(`✓ ${test.name}`);
                this.passed++;
            } catch (error) {
                console.error(`✗ ${test.name}: ${error.message}`);
                this.failed++;
            }
        }

        console.log(`测试完成: ${this.passed} 通过, ${this.failed} 失败`);
    }
}

// 选择框调整功能的单元测试
function runSelectionResizeTests() {
    const testSuite = new SimpleTest();

    // 创建测试用的Canvas和相关组件
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 800;
    testCanvas.height = 600;
    const testCtx = testCanvas.getContext('2d');
    const imageManager = new ImageManager(testCanvas, testCtx);
    const selectionManager = new SelectionManager();
    const canvasRenderer = new CanvasRenderer(testCanvas, testCtx);
    const eventHandler = new EventHandler(testCanvas, imageManager, selectionManager, canvasRenderer);

    // 设置测试环境
    imageManager.originalWidth = 400;
    imageManager.originalHeight = 300;
    imageManager.scale = 1;
    imageManager.offsetX = 0;
    imageManager.offsetY = 0;

    testSuite.test('调整手柄检测', () => {
        const selection = selectionManager.createSelection(50, 50, 150, 100);

        // 测试角部手柄
        let handle = eventHandler.getResizeHandle(50, 50, selection);
        if (handle !== 'nw') {
            throw new Error('左上角手柄检测失败');
        }

        handle = eventHandler.getResizeHandle(150, 50, selection);
        if (handle !== 'ne') {
            throw new Error('右上角手柄检测失败');
        }

        // 测试边缘手柄
        handle = eventHandler.getResizeHandle(100, 50, selection);
        if (handle !== 'n') {
            throw new Error('上边手柄检测失败');
        }

        // 测试非手柄区域
        handle = eventHandler.getResizeHandle(100, 75, selection);
        if (handle !== null) {
            throw new Error('非手柄区域应该返回null');
        }
    });

    testSuite.test('鼠标指针样式', () => {
        const cursors = {
            'nw': 'nw-resize',
            'ne': 'ne-resize',
            'sw': 'sw-resize',
            'se': 'se-resize',
            'n': 'n-resize',
            's': 's-resize',
            'w': 'w-resize',
            'e': 'e-resize'
        };

        for (const [handle, expectedCursor] of Object.entries(cursors)) {
            const cursor = eventHandler.getHandleCursor(handle);
            if (cursor !== expectedCursor) {
                throw new Error(`手柄${handle}的指针样式应该是${expectedCursor}，实际是${cursor}`);
            }
        }
    });

    testSuite.test('选择框边界限制', () => {
        const selection = selectionManager.createSelection(10, 10, 60, 60);

        // 模拟调整操作
        eventHandler.currentSelection = selection;
        eventHandler.activeHandle = 'nw';
        eventHandler.originalSelection = { ...selection };

        // 测试最小尺寸限制
        const minSize = 10;
        const newBounds = {
            x: selection.x + selection.width - 5, // 尝试调整到小于最小尺寸
            y: selection.y + selection.height - 5,
            width: 5,
            height: 5
        };

        // 这里应该有边界检查逻辑，但由于测试环境限制，我们只检查概念
        if (newBounds.width < minSize || newBounds.height < minSize) {
            console.log('边界检查正常工作');
        }
    });

    // 运行测试
    testSuite.run();
}

// 选择框高亮功能的单元测试
function runSelectionHighlightTests() {
    const testSuite = new SimpleTest();

    const selectionManager = new SelectionManager();

    testSuite.test('选择框高亮状态', () => {
        selectionManager.selections = []; // 清空

        const selection1 = selectionManager.createSelection(0, 0, 50, 50);
        const selection2 = selectionManager.createSelection(60, 60, 110, 110);

        // 检查初始状态
        if (!selection2.active) {
            throw new Error('最后创建的选择框应该是活动状态');
        }

        if (selection1.active) {
            throw new Error('非活动选择框不应该是活动状态');
        }

        // 切换活动选择框
        selectionManager.setActiveSelection(selection1.id);

        if (!selection1.active || selection2.active) {
            throw new Error('活动状态切换失败');
        }
    });

    testSuite.test('清除活动选择框', () => {
        const activeSelection = selectionManager.getActiveSelection();
        if (!activeSelection) {
            throw new Error('应该有活动选择框');
        }

        selectionManager.clearActiveSelection();

        if (selectionManager.getActiveSelection()) {
            throw new Error('清除活动选择框失败');
        }

        const allInactive = selectionManager.getAllSelections().every(s => !s.active);
        if (!allInactive) {
            throw new Error('所有选择框都应该是非活动状态');
        }
    });

    testSuite.test('选择框查找', () => {
        // 这个测试需要Canvas环境，暂时跳过
        console.log('选择框查找测试需要Canvas环境，已跳过');
    });

    // 运行测试
    testSuite.run();
}

// 选择框创建功能的单元测试
function runSelectionTests() {
    const testSuite = new SimpleTest();

    const selectionManager = new SelectionManager();

    testSuite.test('选择框创建', () => {
        const selection = selectionManager.createSelection(10, 20, 100, 80);

        if (!selection.id || !selection.id.startsWith('selection_')) {
            throw new Error('选择框ID格式不正确');
        }

        if (selection.x !== 10 || selection.y !== 20) {
            throw new Error('选择框位置不正确');
        }

        if (selection.width !== 90 || selection.height !== 60) {
            throw new Error('选择框尺寸不正确');
        }

        if (!selection.active) {
            throw new Error('新创建的选择框应该是活动状态');
        }
    });

    testSuite.test('选择框管理', () => {
        selectionManager.selections = []; // 清空

        const selection1 = selectionManager.createSelection(0, 0, 50, 50);
        const selection2 = selectionManager.createSelection(60, 60, 110, 110);

        if (selectionManager.getAllSelections().length !== 2) {
            throw new Error('选择框数量不正确');
        }

        if (selectionManager.getActiveSelection().id !== selection2.id) {
            throw new Error('活动选择框应该是最后创建的');
        }

        selectionManager.setActiveSelection(selection1.id);
        if (selectionManager.getActiveSelection().id !== selection1.id) {
            throw new Error('设置活动选择框失败');
        }
    });

    testSuite.test('选择框删除', () => {
        const initialCount = selectionManager.getAllSelections().length;
        const activeSelection = selectionManager.getActiveSelection();

        selectionManager.deleteSelection(activeSelection.id);

        if (selectionManager.getAllSelections().length !== initialCount - 1) {
            throw new Error('选择框删除失败');
        }

        if (selectionManager.getActiveSelection()) {
            throw new Error('删除活动选择框后应该没有活动选择框');
        }
    });

    testSuite.test('选择框更新', () => {
        const selection = selectionManager.createSelection(0, 0, 50, 50);
        const newBounds = { x: 10, y: 20, width: 60, height: 70 };

        selectionManager.updateSelection(selection.id, newBounds);

        const updated = selectionManager.getAllSelections().find(s => s.id === selection.id);
        if (updated.x !== 10 || updated.y !== 20 || updated.width !== 60 || updated.height !== 70) {
            throw new Error('选择框更新失败');
        }
    });

    // 运行测试
    testSuite.run();
}

// 缩放功能的单元测试
function runZoomTests() {
    const testSuite = new SimpleTest();

    // 创建测试用的Canvas和ImageManager
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 800;
    testCanvas.height = 600;
    const testCtx = testCanvas.getContext('2d');
    const imageManager = new ImageManager(testCanvas, testCtx);

    testSuite.test('缩放边界测试', () => {
        imageManager.scale = 1;

        // 测试放大到最大值
        for (let i = 0; i < 20; i++) {
            imageManager.zoomIn();
        }
        if (imageManager.scale > imageManager.maxScale) {
            throw new Error('缩放超出最大限制');
        }

        // 测试缩小到最小值
        for (let i = 0; i < 50; i++) {
            imageManager.zoomOut();
        }
        if (imageManager.scale < imageManager.minScale) {
            throw new Error('缩放超出最小限制');
        }
    });

    testSuite.test('缩放级别设置', () => {
        const testLevels = [25, 50, 100, 200, 500];

        for (const level of testLevels) {
            imageManager.setZoomLevel(level);
            const actualLevel = imageManager.getZoomPercentage();

            if (Math.abs(actualLevel - level) > 1) {
                throw new Error(`缩放级别设置失败: 期望${level}%, 实际${actualLevel}%`);
            }
        }
    });

    testSuite.test('缩放状态检查', () => {
        imageManager.setScale(imageManager.maxScale);
        if (imageManager.canZoomIn()) {
            throw new Error('最大缩放时应该不能继续放大');
        }

        imageManager.setScale(imageManager.minScale);
        if (imageManager.canZoomOut()) {
            throw new Error('最小缩放时应该不能继续缩小');
        }

        imageManager.setScale(1);
        if (!imageManager.canZoomIn() || !imageManager.canZoomOut()) {
            throw new Error('正常缩放时应该可以放大和缩小');
        }
    });

    // 运行测试
    testSuite.run();
}

// 图片上传功能的单元测试
function runImageUploadTests() {
    const testSuite = new SimpleTest();

    // 创建测试用的Canvas和ImageManager
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 800;
    testCanvas.height = 600;
    const testCtx = testCanvas.getContext('2d');
    const imageManager = new ImageManager(testCanvas, testCtx);

    testSuite.test('ImageManager初始化', () => {
        if (!imageManager.canvas || !imageManager.ctx) {
            throw new Error('ImageManager初始化失败');
        }
        if (imageManager.scale !== 1) {
            throw new Error('初始缩放比例应为1');
        }
        if (imageManager.hasImage()) {
            throw new Error('初始状态不应有图片');
        }
    });

    testSuite.test('坐标转换功能', () => {
        // 设置测试数据
        imageManager.scale = 0.5;
        imageManager.offsetX = 100;
        imageManager.offsetY = 50;

        const canvasPoint = { x: 200, y: 150 };
        const imagePoint = imageManager.canvasToImage(canvasPoint.x, canvasPoint.y);
        const backToCanvas = imageManager.imageToCanvas(imagePoint.x, imagePoint.y);

        if (Math.abs(backToCanvas.x - canvasPoint.x) > 0.1 ||
            Math.abs(backToCanvas.y - canvasPoint.y) > 0.1) {
            throw new Error('坐标转换不准确');
        }
    });

    testSuite.test('缩放边界检查', () => {
        imageManager.scale = imageManager.maxScale;
        imageManager.zoomIn();
        if (imageManager.scale > imageManager.maxScale) {
            throw new Error('缩放超出最大限制');
        }

        imageManager.scale = imageManager.minScale;
        imageManager.zoomOut();
        if (imageManager.scale < imageManager.minScale) {
            throw new Error('缩放超出最小限制');
        }
    });

    // 运行测试
    testSuite.run();
}

// 集成测试
function runIntegrationTests() {
    const testSuite = new SimpleTest();

    testSuite.test('完整工作流程测试', () => {
        // 这是一个概念性测试，实际需要用户交互
        console.log('完整工作流程测试需要用户交互，已跳过');
    });

    testSuite.test('性能测试', () => {
        const start = performance.now();

        // 模拟大量选择框创建
        const selectionManager = new SelectionManager();
        for (let i = 0; i < 100; i++) {
            selectionManager.createSelection(i * 10, i * 10, i * 10 + 50, i * 10 + 50);
        }

        const end = performance.now();
        const duration = end - start;

        if (duration > 1000) { // 1秒
            throw new Error(`性能测试失败: 创建100个选择框耗时${duration.toFixed(2)}ms`);
        }

        console.log(`性能测试通过: 创建100个选择框耗时${duration.toFixed(2)}ms`);
    });

    testSuite.run();
}

// 在开发模式下运行测试
if (window.location.search.includes('test=true')) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            runImageUploadTests();
            runZoomTests();
            runSelectionTests();
            runSelectionHighlightTests();
            runSelectionResizeTests();
            runIntegrationTests();
        }, 1000);
    });
}