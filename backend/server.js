require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { JSDOM } = require('jsdom'); // Для обработки HTML

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

let currentPrompt = '';
let currentModel = '';

// Маршрут для получения модели и запроса от клиента
app.post('/api/query', (req, res) => {
    const { model, prompt } = req.body;

    if (!model || !prompt) {
        return res.status(400).json({ error: 'Model and prompt are required' });
    }

    currentModel = model;
    currentPrompt = prompt;

    // Уведомляем, что данные приняты
    res.status(200).json({ message: 'Query received. You can now connect to /api/stream.' });
});

// Маршрут для стриминга ответа
app.get('/api/stream', async (req, res) => {
    if (!currentPrompt || !currentModel) {
        return res.status(400).json({ error: 'No query available. Please send a POST request to /api/query first.' });
    }

    // Устанавливаем заголовки для SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        // Запрос к Ollama API
        const response = await axios.post(
            'http://localhost:11434/api/generate',
            { model: currentModel, prompt: currentPrompt },
            { responseType: 'stream' }
        );

        response.data.on('data', (chunk) => {
            const lines = chunk.toString().trim().split('\n');
            for (const line of lines) {
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.response) {
                        res.write(`data: ${parsed.response}\n\n`); // Отправляем символы клиенту
                    }
                } catch (err) {
                    console.error('Ошибка парсинга строки:', err.message);
                }
            }
        });

        response.data.on('end', () => {
            res.write('data: [DONE]\n\n');
            res.end();
        });

        response.data.on('error', (err) => {
            console.error('Ошибка потока:', err.message);
            res.write('data: [ERROR]\n\n');
            res.end();
        });
    } catch (error) {
        console.error('Ошибка при запросе к Ollama:', error.message);
        res.status(500).json({ error: 'Something went wrong', details: error.message });
    }
});

// Новый эндпоинт для загрузки документа по URL
app.post('/api/fetch-document', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        // Загружаем содержимое по URL
        const response = await axios.get(url);
        const contentType = response.headers['content-type'];

        let textContent = '';

        if (contentType.includes('text/html')) {
            // Если это HTML, извлекаем текст
            const dom = new JSDOM(response.data);
            textContent = dom.window.document.body.textContent || '';
        } else if (contentType.includes('application/pdf')) {
            // Для PDF можно использовать библиотеку pdf-parse
            const pdfParse = require('pdf-parse');
            const pdfData = await pdfParse(response.data);
            textContent = pdfData.text;
        } else {
            // Обработка других типов
            textContent = response.data.toString();
        }

        res.json({ text: textContent });
    } catch (error) {
        console.error('Ошибка загрузки документа:', error.message);
        res.status(500).json({ error: 'Не удалось загрузить документ', details: error.message });
    }
});

// Новый эндпоинт для анализа текста модели
app.post('/api/analyze-document', async (req, res) => {
    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Text is required' });
    }

    try {
        // Отправляем текст модели
        const modelResponse = await axios.post(
            'http://localhost:11434/api/generate',
            {
                model: currentModel || 'llama2',
                prompt: `Анализируй следующий текст:\n${text}`,
            }
        );

        res.json({ response: modelResponse.data.response });
    } catch (error) {
        console.error('Ошибка анализа текста:', error.message);
        res.status(500).json({ error: 'Не удалось проанализировать текст', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});