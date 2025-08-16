// 等待DOM完全加载后再执行脚本
document.addEventListener('DOMContentLoaded', () => {

    // --- Part 1: 模拟数据对象 (单一数据源) ---
    // 根据您的要求，我们更新了数据格式
    const mockData = {
        'recognize-waybill': {
            image: 'img/waybill_sample.png',
            format: 'xml',
            results: `<?xml version="1.0" encoding="UTF-8"?>
<Waybill>
    <WaybillNumber>SF1234567890123</WaybillNumber>
    <Sender>
        <Name>张三</Name>
        <Phone>13800138000</Phone>
        <Address>广东省深圳市南山区科技园</Address>
    </Sender>
    <Recipient>
        <Name>李四</Name>
        <Phone>13900139000</Phone>
        <Address>北京市海淀区中关村</Address>
    </Recipient>
    <Item>文件</Item>
    <Confidence>0.98</Confidence>
</Waybill>`
        },
        'recognize-invoice': {
            image: 'img/invoice_sample.png',
            format: 'json',
            results: { // 直接使用JSON对象以便于解析
                "类型": "增值税普通发票",
                "发票代码": "031001900111",
                "发票号码": "GHOHH_1",
                "开票日期": "2019-10-31",
                "校验码": "12345678901234567890",
                "购买方": { "名称": "Dr. 约翰· 多", "纳税人识别号": "-" },
                "销售方": { "名称": "开科思（上海）商务信息咨询有限公司", "纳税人识别号": "91310115MA1K8G0G2B" },
                "金额合计": "3089.90",
                "税额合计": "174.90",
                "价税合计（小写）": "3089.90",
                "发票详单": [
                    { "项目名称": "标准润色 Job code: GHOHH_1", "金额": "1827.00", "税率": "6%" },
                    { "项目名称": "稿件格式排版", "金额": "1088.00", "税率": "6%" }
                ]
            }
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
Room03-07, 3F Taikang Insurance Tower, No.429 North Nanquan Road,
Pudong New District,Shanghai 200120, P.R.China
Tel:(86-21)6888-1166CeI1:17791906807/18916839772
E-mail:Xiaojun.li@kokusai-electric.com
------------------------------------------------------------------
发件人：Huang Wenxi／黄文希<wenxi.huang@kokusai-electric.com>
发送时间：2025年6月20日15:19
收件人：LiXiaojun／李驰骏<xiaojun.li@kokusai-electric.com>
主题：SiEN交际费用申请相关20250623

骁骏
辛苦了
计划下周一晚上和SiEN进行会餐，培养coach，维护客户关系。
申请以下招待费用，麻烦批准，谢谢。
1.时间：20250623
2.地点：青岛
3.目的：客户关系维护
4.出席人数：6人
SiEN：曹辰（采购经理）宋乃绪（主任）马连升（采购）邓悦（leader）娄培阳（user)
KE 黄文希
5.是否可以会餐：<客户商务会餐·赠礼基准一览表>中有SiEN，可以进行会餐。
预算：350RMB/人Total:6人=2100RMB` // [1]
        },
        'audit': {
            image: 'img/invoice_sample.png',
            format: 'json', // 审核结果也使用JSON格式
            results: {
                "审核结果": "审核通过",
                "审核规则符合项": [
                    { "规则": "发票与附件金额匹配", "状态": "通过", "详情": "发票不含税金额 ¥2915.00，与采购单金额一致。" },
                    { "规则": "发票信息合规性检查", "状态": "通过", "详情": "发票代码、号码、开票日期等格式正确，销售方信息有效。" },
                    { "规则": "报销政策检查", "状态": "通过", "详情": "报销项目“标准润色”、“稿件格式排版”符合公司政策。" }
                ],
                "风险提示": "无"
            }
        }
    };

    // --- Part 2: 状态管理 ---
    const appState = {
        uploaded: false,
        recognized: { waybill: false, invoice: false, attachment: false },
        get allRecognized() {
            return this.recognized.waybill && this.recognized.invoice && this.recognized.attachment;
        }
    };

    // --- Part 3: DOM 元素引用 ---
    const controlPanel = document.getElementById('control-panel');
    const recognitionStep = document.getElementById('recognition-step');
    const auditStep = document.getElementById('audit-step');
    const displayPanelPlaceholder = document.querySelector('.placeholder');
    const imageDisplay = document.getElementById('image-display');
    const resultsDisplay = document.getElementById('results-display');
    const resultsContent = document.getElementById('results-content');
    const imgElement = imageDisplay.querySelector('img');

    // --- Part 4: 主事件处理器 (事件委托) ---
    controlPanel.addEventListener('click', (event) => {
        if (event.target.tagName === 'BUTTON') {
            const action = event.target.dataset.action;
            handleAction(action);
        }
    });

    // --- Part 5: 核心逻辑与UI更新函数 ---
    function handleAction(action) {
        if (mockData[action]) {
            updateDisplay(action);
        }
        updateState(action);
    }

    function updateDisplay(action) {
        displayPanelPlaceholder.classList.add('hidden');
        const data = mockData[action];
        
        imgElement.src = data.image;
        imgElement.alt = `${action} 图片`;
        imageDisplay.classList.remove('hidden');
        
        // 根据数据格式调用不同的渲染函数
        let contentHtml = '';
        switch (data.format) {
            case 'xml':
                contentHtml = renderXml(data.results);
                break;
            case 'json':
                if (action === 'recognize-invoice') {
                    contentHtml = renderInvoiceJson(data.results);
                } else {
                    contentHtml = renderDefaultJson(data.results);
                }
                break;
            case 'text':
                contentHtml = renderText(data.results);
                break;
            default:
                contentHtml = `<pre>${data.results}</pre>`;
        }
        resultsContent.innerHTML = contentHtml;
        resultsDisplay.classList.remove('hidden');
    }

    // --- Part 6: 定制化渲染函数 ---

    // 渲染XML为键值对列表
    function renderXml(xmlString) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");
        const root = xmlDoc.documentElement;
        let html = '<div class="xml-display"><ul>';
        
        function parseNode(node, level = 0) {
            const children = Array.from(node.children);
            if (children.length > 0) {
                html += `<li><span class="tag-name">${node.tagName}:</span><ul>`;
                children.forEach(child => parseNode(child, level + 1));
                html += '</ul></li>';
            } else {
                html += `<li><span class="tag-name">${node.tagName}:</span> <span class="tag-content">${node.textContent}</span></li>`;
            }
        }
        
        parseNode(root);
        html += '</ul></div>';
        return html;
    }

    // 专门渲染发票JSON
    function renderInvoiceJson(data) {
        let html = '<div class="invoice-summary">';
        html += `<div class="summary-item"><span class="key">发票号码:</span> <span>${data['发票号码']}</span></div>`;
        html += `<div class="summary-item"><span class="key">发票金额:</span> <span>¥${data['金额合计']}</span></div>`;
        html += `<div class="summary-item"><span class="key">发票税额:</span> <span>¥${data['税额合计']}</span></div>`;
        html += '</div>';

        html += '<h4>购买明细</h4>';
        html += '<table class="invoice-details-table"><thead><tr><th>项目名称</th><th>金额</th><th>税率</th></tr></thead><tbody>';
        data['发票详单'].forEach(item => {
            html += `<tr><td>${item['项目名称']}</td><td>${item['金额']}</td><td>${item['税率']}</td></tr>`;
        });
        html += '</tbody></table>';
        return html;
    }
    
    // 渲染附件TXT
    function renderText(textData) {
        return `<pre>${textData}</pre>`;
    }

    // 默认的JSON渲染（用于审核结果）
    function renderDefaultJson(jsonData) {
        return `<pre>${JSON.stringify(jsonData, null, 2)}</pre>`;
    }

    // --- Part 7: 状态更新与UI刷新 ---
    function updateState(action) {
        switch(action) {
            case 'upload':
                appState.uploaded = true;
                break;
            case 'recognize-waybill':
                appState.recognized.waybill = true;
                break;
            case 'recognize-invoice':
                appState.recognized.invoice = true;
                break;
            case 'recognize-attachment':
                appState.recognized.attachment = true;
                break;
        }
        refreshUI();
    }

    function refreshUI() {
        if (appState.uploaded) {
            recognitionStep.classList.remove('disabled');
            recognitionStep.querySelectorAll('button').forEach(btn => btn.disabled = false);
        }
        if (appState.allRecognized) {
            auditStep.classList.remove('disabled');
            auditStep.querySelector('button').disabled = false;
        }
    }
});