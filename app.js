// =====================================================
// CẤU HÌNH MQTT
// =====================================================

const BROKER_URL = "ws://broker.emqx.io:8083/mqtt";

// Client ID ngẫu nhiên
const clientId = "web_client_" + Math.random().toString(16).substr(2, 8);

// =====================================================
// BIẾN TOÀN CỤC
// =====================================================

let mqttClient = null;
let currentSubTopic = null; // Topic đang được subscribe

// =====================================================
// KẾT NỐI MQTT
// =====================================================

function connectToBroker() {
    const options = {
        keepalive: 60,
        clientId: clientId,
        protocolId: "MQTT",
        protocolVersion: 4,
        clean: true,
        reconnectPeriod: 2000,
        connectTimeout: 30 * 1000,
    };

    mqttClient = mqtt.connect(BROKER_URL, options);

    // Kết nối thành công
    mqttClient.on("connect", () => {
        console.log("Kết nối MQTT thành công:", clientId);
        updateStatus("✅ Đã kết nối MQTT Broker", "green");
    });

    // Lỗi kết nối
    mqttClient.on("error", (err) => {
        console.error("MQTT lỗi:", err);
        updateStatus("❌ Kết nối MQTT thất bại", "red");
    });

    // Mất kết nối
    mqttClient.on("close", () => {
        console.log("Mất kết nối MQTT");
        updateStatus("❌ Mất kết nối MQTT", "red");
        currentSubTopic = null;
        updateSubStatus("Chưa subscribe topic nào");
    });

    // Đang reconnect
    mqttClient.on("reconnect", () => {
        console.log("Đang kết nối lại...");
        updateStatus("🔄 Đang kết nối lại MQTT...", "orange");
    });

    // Nhận message từ bất kỳ topic nào đã subscribe
    mqttClient.on("message", (topic, message) => {
        const payload = message.toString();
        console.log("Topic:", topic);
        console.log("Data:", payload);

        // Xử lý dữ liệu cảm biến (JSON)
        handleSensorData(payload);
    });
}

// =====================================================
// SUBSCRIBE / UNSUBSCRIBE
// =====================================================

function subscribeTopic() {
    if (!mqttClient || !mqttClient.connected) {
        alert("Chưa kết nối MQTT Broker!");
        return;
    }

    const topic = document.getElementById("subTopic").value.trim();
    if (!topic) {
        alert("Vui lòng nhập Topic Subscribe!");
        return;
    }

    // Nếu đang sub topic khác → unsub trước
    if (currentSubTopic && currentSubTopic !== topic) {
        mqttClient.unsubscribe(currentSubTopic);
    }

    mqttClient.subscribe(topic, { qos: 0 }, (err) => {
        if (err) {
            console.error("Subscribe lỗi:", err);
            updateSubStatus("❌ Subscribe thất bại: " + topic);
        } else {
            currentSubTopic = topic;
            console.log("Đã subscribe:", topic);
            updateSubStatus("✅ Đang subscribe: " + topic);
        }
    });
}

function unsubscribeTopic() {
    if (!mqttClient || !mqttClient.connected) {
        alert("Chưa kết nối MQTT Broker!");
        return;
    }

    const topic = document.getElementById("subTopic").value.trim() || currentSubTopic;
    if (!topic) {
        alert("Không có topic để unsubscribe!");
        return;
    }

    mqttClient.unsubscribe(topic, (err) => {
        if (err) {
            console.error("Unsubscribe lỗi:", err);
        } else {
            console.log("Đã unsubscribe:", topic);
            if (currentSubTopic === topic) {
                currentSubTopic = null;
            }
            updateSubStatus("Đã unsubscribe: " + topic);
        }
    });
}

// =====================================================
// XỬ LÝ DỮ LIỆU CẢM BIẾN
// =====================================================

function handleSensorData(payload) {
    try {
        const data = JSON.parse(payload);

        // Cập nhật nhiệt độ
        if (data.temperature !== undefined) {
            document.getElementById("temperature").textContent = data.temperature;
        }

        // Cập nhật độ ẩm
        if (data.humidity !== undefined) {
            document.getElementById("humidity").textContent = data.humidity;
        }

        // Cập nhật trạng thái quạt (nếu ESP32 gửi)
        if (data.fan !== undefined) {
            updateFanStatus(data.fan);
        }

        console.log("Temperature:", data.temperature);
        console.log("Humidity:", data.humidity);
        console.log("Fan:", data.fan);
    } catch (error) {
        // Không phải JSON → bỏ qua hoặc log
        console.log("Nhận message không phải JSON:", payload);
    }
}

// =====================================================
// CẬP NHẬT GIAO DIỆN
// =====================================================

function updateStatus(text, color) {
    const statusEl = document.getElementById("status");
    statusEl.textContent = text;
    statusEl.style.color = color || "#333";
}

function updateSubStatus(text) {
    const el = document.getElementById("subStatus");
    if (el) el.textContent = text;
}

function updateFanStatus(fan) {
    const fanStatus = document.getElementById("fanStatus");

    if (fan === "ON") {
        fanStatus.innerHTML = "🟢 Quạt đang BẬT";
        fanStatus.style.color = "green";
    } else if (fan === "OFF") {
        fanStatus.innerHTML = "🔴 Quạt đang TẮT";
        fanStatus.style.color = "red";
    } else {
        fanStatus.innerHTML = "Trạng thái quạt: " + fan;
        fanStatus.style.color = "#333";
    }
}

// =====================================================
// GỬI LỆNH ĐIỀU KHIỂN QUẠT
// =====================================================

function publishFanCommand(command) {
    if (!mqttClient || !mqttClient.connected) {
        alert("Chưa kết nối MQTT Broker!");
        return;
    }

    const topic = document.getElementById("pubTopic").value.trim();
    if (!topic) {
        alert("Vui lòng nhập Topic Publish!");
        return;
    }

    const data = { fan: command };
    const payload = JSON.stringify(data);

    console.log("Gửi tới topic:", topic, "→", payload);

    mqttClient.publish(topic, payload, {
        qos: 0,
        retain: false,
    });

    // Cập nhật giao diện ngay lập tức
    updateFanStatus(command);
}

// =====================================================
// SỰ KIỆN NÚT BẤM
// =====================================================

function setupEventListeners() {
    document.getElementById("btnFanOn").addEventListener("click", () => {
        publishFanCommand("ON");
    });

    document.getElementById("btnFanOff").addEventListener("click", () => {
        publishFanCommand("OFF");
    });

    document.getElementById("btnSubscribe").addEventListener("click", () => {
        subscribeTopic();
    });

    document.getElementById("btnUnsubscribe").addEventListener("click", () => {
        unsubscribeTopic();
    });
}

// =====================================================
// KHỞI CHẠY
// =====================================================

window.addEventListener("load", () => {
    setupEventListeners();
    connectToBroker();
});