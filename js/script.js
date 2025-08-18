// 等待DOM完全加载后再执行脚本
document.addEventListener('DOMContentLoaded', () => {

    // --- Part 1: 模拟数据对象 (单一数据源) ---
    const mockData = {
        'recognize-waybill': {
            image: 'img/waybill_sample.png',
            format: 'xml',
            results: `<?xml version="1.0" encoding="UTF-8"?>
<Waybill>
    <WaybillNumber>SF1234567890123</WaybillNumber>
    <Sender><Name>张三</Name><Phone>13800138000</Phone><Address>广东省深圳市南山区科技园</Address></Sender>
    <Recipient><Name>李四</Name><Phone>13900139000</Phone><Address>北京市海淀区中关村</Address></Recipient>
    <Item>文件</Item>
    <Confidence>0.98</Confidence>
</Waybill>`
        },
        'recognize-invoice': {
            image: 'img/invoice_sample.png',
            format: 'json',
            results: { "类型": "增值税普通发票", "发票代码": "031001900111", "发票号码": "GHOHH_1", "开票日期": "2019-10-31", "校验码": "12345678901234567890", "购买方": { "名称": "Dr. 约翰· 多", "纳税人识别号": "-" }, "销售方": { "名称": "开科思（上海）商务信息咨询有限公司", "纳税人识别号": "91310115MA1K8G0G2B" }, "金额合计": "3089.90", "税额合计": "174.90", "价税合计（小写）": "3089.90", "发票详单": [{ "项目名称": "标准润色 Job code: GHOHH_1", "金额": "1827.00", "税率": "6%" }, { "项目名称": "稿件格式排版", "金额": "1088.00", "税率": "6%" }] }
        },
        'recognize-attachment': {
            image: 'img/attachment_sample.png',
            format: 'text',
            results: `Approved

地区设备销售部李晓骏
KOKUSAI ELECTRIC
科意半导体设备（上海）有限公司
KE Semiconductor Equipment (Shanghai)Co., Ltd.
中国上海市浦东新区南泉北路429号泰康保险大厦3楼03-07室，200120
... (内容已省略)...
预算：350RMB/人Total:6人=2100RMB`
        },
        'audit': {
            images: [ 'img/waybill_sample.png', 'img/invoice_sample.png', 'img/attachment_sample.png' ],
            format: 'json',
            results: { "审核结果": "审核通过", "审核规则符合项": [{ "规则": "发票与附件金额匹配", "状态": "通过", "详情": "发票不含税金额 ¥2915.00，与采购单金额一致。" }, { "规则": "发票信息合规性检查", "状态": "通过", "详情": "发票代码、号码、开票日期等格式正确，销售方信息有效。" }, { "规则": "报销政策检查", "状态": "通过", "详情": "报销项目“标准润色”、“稿件格式排版”符合公司政策。" }], "风险提示": "无" }
        }
    };

    // ---  状态管理 ---
   const appState = {
        uploads: { waybill: null, invoice: null, attachment: null },
        audit: { currentImageIndex: 0, zoomLevel: 1.0 },
        get allFilesUploaded() { return this.uploads.waybill && this.uploads.invoice && this.uploads.attachment; }
    };

    // --- Part 2: DOM 元素引用 ---
    const controlPanel = document.getElementById('control-panel');
    const recognitionStep = document.getElementById('recognition-step');
    const auditStep = document.getElementById('audit-step');
    const displayPanelPlaceholder = document.querySelector('.placeholder');
    const imageDisplay = document.getElementById('image-display');
    const resultsDisplay = document.getElementById('results-display');
    const resultsContent = document.getElementById('results-content');
    const imgElement = imageDisplay.querySelector('img');
    const imageControls = document.getElementById('image-controls');
    
    // 上传模态窗口元素
    const uploadModal = document.getElementById('upload-modal');
    const closeModalBtn = document.querySelector('.modal-close-btn');
    const fileInputs = document.querySelectorAll('.file-input');
    const confirmUploadBtn = document.getElementById('confirm-upload-btn');

    // --- Part 3: 事件处理器 ---
    controlPanel.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') handleAction(e.target.dataset.action);
    });

    imageControls.addEventListener('click', (e) => {
        if (e.target.tagName!== 'BUTTON') return;
        const zoomAction = e.target.dataset.zoom;
        const navAction = e.target.dataset.nav;
        if (zoomAction) handleZoom(zoomAction);
        if (navAction) handleNavigation(navAction);
    });

    // 模态窗口事件
    closeModalBtn.addEventListener('click', () => uploadModal.classList.add('hidden'));
    
    fileInputs.forEach(input => {
        input.addEventListener('change', handleFileSelect);
    });

    confirmUploadBtn.addEventListener('click', handleConfirmUpload);

    // --- Part 4: 核心逻辑函数 ---
    function handleAction(action) {
        if (action === 'upload') {
            uploadModal.classList.remove('hidden');
        } else if (mockData[action]) {
            updateDisplay(action);
        }
    }

    function handleFileSelect(event) {
        const file = event.target.files[0];
        const type = event.target.dataset.type;
        if (!file ||!type) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            appState.uploads[type] = dataUrl;
            
            // 更新预览图和状态
            document.getElementById(`${type}-preview`).src = dataUrl;
            const statusEl = event.target.nextElementSibling.nextElementSibling;
            statusEl.textContent = '已选择';
            statusEl.classList.add('success');

            // 检查是否所有文件都已上传，以启用确认按钮
            if (appState.allFilesUploaded) {
                confirmUploadBtn.disabled = false;
            }
        };
        reader.readAsDataURL(file);
    }

    function handleConfirmUpload() {
        // 使用用户上传的图片更新mockData
        mockData['recognize-waybill'].image = appState.uploads.waybill;
        mockData['recognize-invoice'].image = appState.uploads.invoice;
        mockData['recognize-attachment'].image = appState.uploads.attachment;
        // 修正：将三张图片的路径赋值给 audit.images 数组
        mockData['audit'].images = [appState.uploads.waybill, appState.uploads.invoice, appState.uploads.attachment];

        uploadModal.classList.add('hidden');
        recognitionStep.classList.remove('disabled');
        recognitionStep.querySelectorAll('button').forEach(btn => btn.disabled = false);
    }

    function updateDisplay(action) {
        displayPanelPlaceholder.classList.add('hidden');
        const data = mockData[action];
        
        if (action === 'audit') {
            appState.audit.currentImageIndex = 0;
            imgElement.src = data.images[0];
            imgElement.alt = `审核图片 1/${data.images.length}`;
            imageControls.classList.remove('hidden');
        } else {
            imgElement.src = data.image;
            imgElement.alt = `${action} 图片`;
            imageControls.classList.add('hidden');
        }
        
        appState.audit.zoomLevel = 1.0;
        imgElement.style.transform = `scale(${appState.audit.zoomLevel})`;
        imageDisplay.classList.remove('hidden');
        
        let contentHtml = '';
        switch (data.format) {
            case 'xml': contentHtml = renderXml(data.results); break;
            case 'json':
                contentHtml = (action === 'recognize-invoice')? renderInvoiceJson(data.results) : renderDefaultJson(data.results);
                break;
            case 'text': contentHtml = renderText(data.results); break;
            default: contentHtml = `<pre>${JSON.stringify(data.results, null, 2)}</pre>`;
        }
        resultsContent.innerHTML = contentHtml;
        resultsDisplay.classList.remove('hidden');

        // 在 updateDisplay 函数的尾部
        if (action.startsWith('recognize-')) {
            const type = action.split('-')[1];
            if (type === 'waybill' || type === 'invoice' || type === 'attachment') {
        
            // 正确：先标记当前按钮为已识别
            controlPanel.querySelector(`[data-action="${action}"]`).dataset.recognized = 'true';

            // 然后再检查是否所有按钮都已识别
            const allRecognized = !Array.from(recognitionStep.querySelectorAll('button')).some(btn => !btn.dataset.recognized);
            if (allRecognized) {
                auditStep.classList.remove('disabled');
                auditStep.querySelector('button').disabled = false;
                }   
            }
        }
    }

    // --- Part 5: 辅助与渲染函数 ---
    // (为简洁起见，将不变的函数体折叠，实际代码中应保留完整内容)
    function handleNavigation(direction) {
        const images = mockData['audit'].images;
        const total = images.length;
        let index = appState.audit.currentImageIndex;
        if (direction === 'next') index = (index + 1) % total;
        else if (direction === 'prev') index = (index - 1 + total) % total;
        appState.audit.currentImageIndex = index;
        imgElement.src = images[index];
        imgElement.alt = `审核图片 ${index + 1}/${total}`;
        appState.audit.zoomLevel = 1.0;
        imgElement.style.transform = `scale(${appState.audit.zoomLevel})`;
    }
    function handleZoom(direction) {
        const ZOOM_STEP = 0.2, MAX_ZOOM = 3.0, MIN_ZOOM = 0.4;
        let level = appState.audit.zoomLevel;
        if (direction === 'in') level = Math.min(level + ZOOM_STEP, MAX_ZOOM);
        else if (direction === 'out') level = Math.max(level - ZOOM_STEP, MIN_ZOOM);
        appState.audit.zoomLevel = level;
        imgElement.style.transform = `scale(${level})`;
    }
    function renderXml(xmlString) {
        const parser = new DOMParser(); const xmlDoc = parser.parseFromString(xmlString, "text/xml");
        let html = '<div class="xml-display"><ul>';
        function parseNode(node) {
            const children = Array.from(node.children);
            if (children.length > 0) {
                html += `<li><span class="tag-name">${node.tagName}:</span><ul>`;
                children.forEach(parseNode);
                html += '</ul></li>';
            } else {
                html += `<li><span class="tag-name">${node.tagName}:</span> <span class="tag-content">${node.textContent}</span></li>`;
            }
        }
        parseNode(xmlDoc.documentElement);
        html += '</ul></div>'; return html;
    }
    function renderInvoiceJson(data) {
        if (data.审核结果) return renderDefaultJson(data);
        let html = '<div class="invoice-summary">';
        html += `<div class="summary-item"><span class="key">发票号码:</span> <span>${data['发票号码']}</span></div>`;
        html += `<div class="summary-item"><span class="key">发票金额:</span> <span>¥${data['金额合计']}</span></div>`;
        html += `<div class="summary-item"><span class="key">发票税额:</span> <span>¥${data['税额合计']}</span></div>`;
        html += '</div><h4>购买明细</h4><table class="invoice-details-table"><thead><tr><th>项目名称</th><th>金额</th><th>税率</th></tr></thead><tbody>';
        data['发票详单'].forEach(item => { html += `<tr><td>${item['项目名称']}</td><td>${item['金额']}</td><td>${item['税率']}</td></tr>`; });
        html += '</tbody></table>'; return html;
    }
    function renderText(textData) { return `<pre>${textData}</pre>`; }
    function renderDefaultJson(jsonData) { return `<pre>${JSON.stringify(jsonData, null, 2)}</pre>`; }
});