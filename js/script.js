document.addEventListener('DOMContentLoaded', () => {

    // --- Part 1: 数据与状态管理 ---
    const mockData = {
        'recognize-waybill': { image: 'img/waybill_sample.png', format: 'xml', results: `<?xml version="1.0" encoding="UTF-8"?><document><page><item><name>运单号</name><value>SF1234567890123</value></item><item><name>寄件人</name><value>张三, 13800138000</value></item><item><name>收件人</name><value>李四, 13900139000</value></item><item><name>物品</name><value>文件</value></item><table name="费用明细"><thead><tr><th>项目</th><th>金额</th><th>备注</th></tr></thead><tbody><tr><td>运费</td><td>18.00</td><td></td></tr><tr><td>保价费</td><td>2.00</td><td>保价2000元</td></tr></tbody></table></page></document>` },
        'recognize-invoice': { image: 'img/invoice_sample.png', format: 'json', results: { "类型": "增值税普通发票", "发票代码": "031001900111", "发票号码": "GHOHH_1", "开票日期": "2019-10-31", "购买方": { "名称": "Dr. 约翰· 多" }, "销售方": { "名称": "开科思（上海）商务信息咨询有限公司" }, "金额合计": "3089.90", "税额合计": "174.90", "发票详单": [{ "项目名称": "标准润色 Job code: GHOHH_1", "金额": "1827.00", "税率": "6%" }, { "项目名称": "稿件格式排版", "金额": "1088.00", "税率": "6%" }] } },
        'recognize-attachment': { image: 'img/attachment_sample.png', format: 'text', results: `Approved\n\n地区设备销售部李晓骏\nKOKUSAI ELECTRIC\n科意半导体设备（上海）有限公司\n预算：350RMB/人Total:6人=2100RMB` },
        'audit': { images: ['img/waybill_sample.png', 'img/invoice_sample.png', 'img/attachment_sample.png'], format: 'json', results: { "审核结果": "审核通过", "审核规则符合项": [{ "规则": "发票与附件金额匹配", "状态": "通过" }, { "规则": "发票信息合规性检查", "状态": "通过" }, { "规则": "报销政策检查", "状态": "通过" }], "风险提示": "无" } }
    };

    let auditPrompts = [
        "核对发票金额与附件金额是否一致。",
        "检查发票抬头是否为公司全称。",
        "确认报销内容是否在允许的业务招待范围内。"
    ];

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
    
    // 模态窗口元素
    const uploadModal = document.getElementById('upload-modal');
    const promptsModal = document.getElementById('prompts-modal');
    const closeModalBtns = document.querySelectorAll('.modal-close-btn');
    const fileInputs = document.querySelectorAll('.file-input');
    const confirmUploadBtn = document.getElementById('confirm-upload-btn');
    const promptsList = document.getElementById('prompts-list');
    const promptInput = document.getElementById('prompt-input');
    const savePromptBtn = document.getElementById('save-prompt-btn');

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

    closeModalBtns.forEach(btn => btn.addEventListener('click', () => {
        document.getElementById(btn.dataset.modalId).classList.add('hidden');
    }));
    
    fileInputs.forEach(input => input.addEventListener('change', handleFileSelect));
    confirmUploadBtn.addEventListener('click', handleConfirmUpload);
    savePromptBtn.addEventListener('click', handleSavePrompt);
    promptsList.addEventListener('click', handlePromptListActions);

    // --- Part 4: 核心逻辑函数 ---
    function handleAction(action) {
        if (action === 'upload') {
            uploadModal.classList.remove('hidden');
        } else if (action === 'manage-prompts') {
            openPromptsModal();
        } else if (mockData[action]) {
            updateDisplay(action);
        }
    }

    function handleConfirmUpload() {
        mockData['recognize-waybill'].image = appState.uploads.waybill;
        mockData['recognize-invoice'].image = appState.uploads.invoice;
        mockData['recognize-attachment'].image = appState.uploads.attachment;
        mockData['audit'].images = [appState.uploads.waybill, appState.uploads.invoice, appState.uploads.attachment];

        uploadModal.classList.add('hidden');
        startRecognitionSimulation();
    }

    // --- 新增：启动识别模拟 ---
    function startRecognitionSimulation() {
        const buttons = recognitionStep.querySelectorAll('button');
        buttons.forEach(button => {
            button.disabled = true;
            button.dataset.status = 'processing';
            button.classList.add('processing');
            
            const originalText = button.textContent;
            button.innerHTML = `<span class="spinner"></span> 识别中...`;

            const randomDelay = Math.random() * 5000 + 5000; // 5-10 seconds

            setTimeout(() => {
                button.classList.remove('processing');
                button.classList.add('success');
                button.dataset.status = 'success';
                
                // --- 已修改：根据按钮原始文本生成新的成功文本 ---
                const docType = originalText.replace(/2\.\d\s*识别/g, '').trim(); // "面单", "发票", "附件"
                button.innerHTML = `✓ ${docType}结果`;
                
                button.disabled = false;
                checkAllRecognized();
            }, randomDelay);
        });
    }

    // --- 新增：检查所有识别是否完成 ---
    function checkAllRecognized() {
        const buttons = recognitionStep.querySelectorAll('button');
        const allDone = Array.from(buttons).every(btn => btn.dataset.status === 'success');
        if (allDone) {
            auditStep.classList.remove('disabled');
            auditStep.querySelectorAll('button').forEach(btn => btn.disabled = false);
        }
    }

    function updateDisplay(action) {
        displayPanelPlaceholder.classList.add('hidden');
        const data = mockData[action];
        
        if (action === 'audit') {
            appState.audit.currentImageIndex = 0;
            // --- 最终修正 ---
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
        if (action === 'audit') {
            const randomPrompt = auditPrompts.length > 0? auditPrompts[Math.floor(Math.random() * auditPrompts.length)] : "无可用提示词";
            const auditResultWithPrompt = {...data.results, "模拟使用提示词": randomPrompt };
            contentHtml = renderDefaultJson(auditResultWithPrompt);
        } else {
            switch (data.format) {
                case 'xml': contentHtml = renderWaybillXml(data.results); break;
                case 'json': contentHtml = renderInvoiceJson(data.results); break;
                case 'text': contentHtml = renderText(data.results); break;
                default: contentHtml = `<pre>${JSON.stringify(data.results, null, 2)}</pre>`;
            }
        }
        resultsContent.innerHTML = contentHtml;
        resultsDisplay.classList.remove('hidden');
    }

    // --- Part 5: 提示词管理功能 ---
    function openPromptsModal() {
        renderPrompts();
        promptsModal.classList.remove('hidden');
    }

    function renderPrompts() {
        promptsList.innerHTML = '';
        if (auditPrompts.length === 0) {
            promptsList.innerHTML = '<p>暂无提示词，请在下方添加。</p>';
            return;
        }
        auditPrompts.forEach((prompt, index) => {
            const item = document.createElement('div');
            item.className = 'prompt-item';
            item.innerHTML = `
                <span>${prompt.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>
                <div class="actions">
                    <button class="btn-secondary" data-action="edit-prompt" data-index="${index}">编辑</button>
                    <button class="btn-secondary" data-action="delete-prompt" data-index="${index}">删除</button>
                </div>
            `;
            promptsList.appendChild(item);
        });
    }

    function handleSavePrompt() {
        const newText = promptInput.value.trim();
        if (!newText) return;

        const mode = savePromptBtn.dataset.mode;
        if (mode === 'add') {
            auditPrompts.push(newText);
        } else if (mode === 'edit') {
            const index = savePromptBtn.dataset.index;
            auditPrompts[index] = newText;
        }

        promptInput.value = '';
        savePromptBtn.textContent = '添加提示词';
        savePromptBtn.dataset.mode = 'add';
        renderPrompts();
    }

    function handlePromptListActions(e) {
        if (e.target.tagName!== 'BUTTON') return;
        const action = e.target.dataset.action;
        const index = e.target.dataset.index;

        if (action === 'edit-prompt') {
            promptInput.value = auditPrompts[index];
            promptInput.focus();
            savePromptBtn.textContent = '保存修改';
            savePromptBtn.dataset.mode = 'edit';
            savePromptBtn.dataset.index = index;
        } else if (action === 'delete-prompt') {
            auditPrompts.splice(index, 1);
            renderPrompts();
        }
    }

    // --- Part 6: 文件上传与预览 ---
    function handleFileSelect(event) {
        const file = event.target.files[0];
        const type = event.target.dataset.type;
        if (!file ||!type) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            appState.uploads[type] = dataUrl;
            document.getElementById(`${type}-preview`).src = dataUrl;
            const statusEl = event.target.nextElementSibling.nextElementSibling;
            statusEl.textContent = '已选择';
            statusEl.classList.add('success');
            if (appState.allFilesUploaded) {
                confirmUploadBtn.disabled = false;
            }
        };
        reader.readAsDataURL(file);
    }

    // --- Part 7: 渲染函数 ---
    function renderWaybillXml(xmlString) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");
        let html = '<div class="waybill-result-container">';

        // Render items
        html += '<h4>基本信息</h4>';
        const items = xmlDoc.querySelectorAll('page > item');
        items.forEach(item => {
            const name = item.querySelector('name')?.textContent || 'N/A';
            const value = item.querySelector('value')?.textContent || 'N/A';
            html += `<div class="xml-item"><span class="xml-key">${name}:</span><span class="xml-value">${value}</span></div>`;
        });

        // Render tables
        const tables = xmlDoc.querySelectorAll('page > table');
        tables.forEach(table => {
            const tableName = table.getAttribute('name') || '识别表格';
            html += `<h4>${tableName}</h4>`;
            html += '<table class="data-table">';
            
            // Head
            const headers = table.querySelectorAll('thead th');
            if (headers.length > 0) {
                html += '<thead><tr>';
                headers.forEach(th => { html += `<th>${th.textContent}</th>`; });
                html += '</tr></thead>';
            }

            // Body
            const rows = table.querySelectorAll('tbody tr');
            if (rows.length > 0) {
                html += '<tbody>';
                rows.forEach(row => {
                    html += '<tr>';
                    const cells = row.querySelectorAll('td');
                    cells.forEach(td => { html += `<td>${td.textContent}</td>`; });
                    html += '</tr>';
                });
                html += '</tbody>';
            }
            html += '</table>';
        });

        html += '</div>';
        return html;
    }

    function renderInvoiceJson(data) {
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

    // --- Part 8: 辅助函数 ---
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
});