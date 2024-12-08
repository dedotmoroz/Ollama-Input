import React, { useState } from "react";

const SYSTEM_MESSAGE = "Ты журналист, твоя задача — задавать вопросы пользователю, но отвечать ты должен только на русском языке, используя естественный стиль. Не переходи на другие языки. Выражай восхищения и всячески подталкивай расказать больше.";

const OllamaInput = () => {
    const [prompt, setPrompt] = useState(""); // Текущий ввод пользователя
    const [response, setResponse] = useState(""); // Текущий ответ модели
    const [conversation, setConversation] = useState([
        { role: "system", text: SYSTEM_MESSAGE },
    ]); // История переписки с системным сообщением
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!prompt) return;

        setLoading(true);

        // Создаём полный контекст для запроса
        const fullContext = conversation
            .map((entry) => `${entry.role === "user" ? "Q:" : entry.role === "assistant" ? "A:" : ""} ${entry.text}`)
            .join("\n");
        const fullPrompt = `${fullContext}\nQ: ${prompt}`;

        try {
            // Отправляем запрос с полным контекстом
            await fetch("http://localhost:5000/api/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model: "llama2", prompt: fullPrompt }),
            });

            // Открываем SSE для получения ответа
            const eventSource = new EventSource("http://localhost:5000/api/stream");

            let newResponse = "";
            eventSource.onmessage = (event) => {
                if (event.data === "[DONE]") {
                    setLoading(false);
                    eventSource.close(); // Закрываем поток
                    // Добавляем текущий запрос и ответ в историю переписки
                    setConversation((prev) => [
                        ...prev,
                        { role: "user", text: prompt },
                        { role: "assistant", text: newResponse },
                    ]);
                    setPrompt(""); // Очищаем ввод пользователя
                } else {
                    newResponse += event.data; // Собираем ответ посимвольно
                    setResponse(newResponse); // Отображаем текущий ответ
                }
            };

            eventSource.onerror = () => {
                setResponse("Ошибка в потоке данных.");
                setLoading(false);
                eventSource.close();
            };
        } catch (error) {
            setResponse(`Ошибка: ${error.message}`);
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault(); // Останавливаем перенос строки
            handleSubmit(e); // Отправляем запрос
        }
    };

    return (
        <div style={{ margin: "20px", fontFamily: "Arial, sans-serif" }}>
            <h1>Работа с Ollama</h1>
            <form onSubmit={handleSubmit} style={{ marginBottom: "20px" }}>
                <textarea
                    rows="4"
                    style={{ width: "100%", padding: "10px", fontSize: "16px" }}
                    placeholder="Введите текст для модели..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown} // Обрабатываем нажатие клавиши
                ></textarea>
                <button
                    type="submit"
                    style={{
                        marginTop: "10px",
                        padding: "10px 20px",
                        fontSize: "16px",
                        backgroundColor: "#007BFF",
                        color: "white",
                        border: "none",
                        borderRadius: "5px",
                        cursor: "pointer",
                    }}
                    disabled={loading}
                >
                    {loading ? "Обработка..." : "Отправить"}
                </button>
            </form>

             Блок для текущего ответа
            {response && (
                <div
                    style={{
                        padding: "10px",
                        backgroundColor: "#F9F9F9",
                        border: "1px solid #DDD",
                        borderRadius: "5px",
                        marginBottom: "20px",
                    }}
                >
                    <h3>Текущий ответ модели:</h3>
                    <p style={{ whiteSpace: "pre-wrap" }}>{response}</p>
                </div>
            )}

             Блок для всей переписки
            {conversation.length > 1 && (
                <div>
                    <h3>История переписки:</h3>
                    {conversation.map((entry, index) => (
                        <div
                            key={index}
                            style={{
                                padding: "10px",
                                backgroundColor: entry.role === "user" ? "#E0F7FA" : entry.role === "assistant" ? "#F1F1F1" : "#FFF8E1",
                                border: "1px solid #DDD",
                                borderRadius: "5px",
                                marginBottom: "10px",
                            }}
                        >
                            <strong>
                                {entry.role === "user" ? "Вы:" : entry.role === "assistant" ? "Модель:" : "Система:"}
                            </strong>
                            <p style={{ whiteSpace: "pre-wrap" }}>{entry.text}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default OllamaInput;


export const OllamaInputFiles = () => {
    const [prompt, setPrompt] = useState("");
    const [response, setResponse] = useState("");
    const [conversation, setConversation] = useState([
        { role: "system", text: SYSTEM_MESSAGE },
    ]);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!prompt) return;

        setLoading(true);

        // Создаём полный контекст
        const fullContext = conversation
            .map((entry) =>
                `${entry.role === "user" ? "Q:" : entry.role === "assistant" ? "A:" : ""} ${entry.text}`
            )
            .join("\n");
        const fullPrompt = `${fullContext}\nQ: ${prompt}`;

        try {
            const response = await fetch("http://localhost:5000/api/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model: "llama2", prompt: fullPrompt }),
            });

            const eventSource = new EventSource("http://localhost:5000/api/stream");
            let newResponse = "";

            eventSource.onmessage = async (event) => {
                if (event.data === "[DONE]") {
                    setLoading(false);
                    eventSource.close();
                    setConversation((prev) => [
                        ...prev,
                        { role: "user", text: prompt },
                        { role: "assistant", text: newResponse },
                    ]);
                    setPrompt("");
                } else {
                    newResponse += event.data;
                    setResponse(newResponse);
                }
            };

            eventSource.onerror = () => {
                setResponse("Ошибка в потоке данных.");
                setLoading(false);
                eventSource.close();
            };
        } catch (error) {
            setResponse(`Ошибка: ${error.message}`);
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                fontFamily: "Arial, sans-serif",
                maxWidth: "600px",
                margin: "20px auto",
                padding: "20px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                backgroundColor: "#f9f9f9",
            }}
        >
            <h1 style={{ textAlign: "center", color: "#333" }}>Чат с моделью Ollama</h1>
            <form onSubmit={handleSubmit} style={{ marginBottom: "20px" }}>
                <textarea
                    rows="4"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Введите ваш вопрос..."
                    style={{
                        width: "100%",
                        padding: "10px",
                        fontSize: "16px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        marginBottom: "10px",
                    }}
                ></textarea>
                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        width: "100%",
                        padding: "10px",
                        fontSize: "16px",
                        backgroundColor: loading ? "#ccc" : "#007BFF",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        cursor: loading ? "not-allowed" : "pointer",
                    }}
                >
                    {loading ? "Обработка..." : "Отправить"}
                </button>
            </form>
            <div>
                {conversation.map((entry, index) => (
                    <div
                        key={index}
                        style={{
                            padding: "10px",
                            marginBottom: "10px",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            backgroundColor: entry.role === "user" ? "#E0F7FA" : "#F1F1F1",
                        }}
                    >
                        <strong>{entry.role === "user" ? "Вы:" : "Модель:"}</strong>
                        <p style={{ whiteSpace: "pre-wrap", margin: "5px 0 0" }}>{entry.text}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
