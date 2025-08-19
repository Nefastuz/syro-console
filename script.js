
document.addEventListener('DOMContentLoaded', () => {
    const inputForm = document.getElementById('input-form');
    const commandInput = document.getElementById('command-input');
    const sendButton = document.getElementById('send-button');
    const promptHistoryContainer = document.getElementById('prompt-history');
    const responseArea = document.getElementById('response-area');
    
    const apiEndpoint = '/api/syro';
    const sendIcon = '<span class="material-icons">send</span>';
    const processingText = '...';
    const historyKey = 'syroPromptHistory';

    // Cargar historial desde localStorage al iniciar
    loadHistory();

    inputForm.addEventListener('submit', (e) => {
        e.preventDefault(); // Evitar que la página se recargue
        sendRequest();
    });

    function loadHistory() {
        const history = JSON.parse(localStorage.getItem(historyKey)) || [];
        promptHistoryContainer.innerHTML = ''; // Limpiar por si acaso
        history.forEach(text => createHistoryButton(text));
    }

    function saveToHistory(text) {
        let history = JSON.parse(localStorage.getItem(historyKey)) || [];
        if (!history.includes(text)) {
            history.push(text);
            localStorage.setItem(historyKey, JSON.stringify(history));
            createHistoryButton(text);
        }
    }

    function createHistoryButton(text) {
        const button = document.createElement('button');
        button.className = 'prompt-button';
        button.textContent = text;
        button.title = text;
        button.onclick = () => {
            commandInput.value = text;
            sendRequest();
        };
        promptHistoryContainer.appendChild(button);
    }

    async function sendRequest() {
        const userInput = commandInput.value.trim();
        if (userInput === '') return;

        setLoadingState(true);
        responseArea.innerHTML = "Procesando...";
        
        try {
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: { text: userInput } })
            });

            if (!response.ok) {
                const errorJson = await response.json();
                throw new Error(errorJson.error?.message || `Error de servidor: ${response.status}`);
            }

            const resultJson = await response.json();
            const syroResponse = resultJson.completion.choices[0].text;
            
            // Sanitizar la respuesta antes de insertarla en el DOM
            const cleanHtml = DOMPurify.sanitize(marked.parse(syroResponse));
            responseArea.innerHTML = cleanHtml;
            
            // Guardar en historial y limpiar el input solo si la petición fue exitosa
            saveToHistory(userInput);
            commandInput.value = '';

        } catch (error) {
            const errorMessage = "Hubo un error al procesar tu solicitud. Por favor, intenta de nuevo.";
            responseArea.innerHTML = `<p style="color: #ff8a8a;"><strong>Error Crítico:</strong><br>${errorMessage}</p>`;
            console.error(error);
            // No limpiamos el input, el usuario puede reintentar
            commandInput.value = userInput;
        } finally {
            setLoadingState(false);
        }
    }

    function setLoadingState(isLoading) {
        sendButton.disabled = isLoading;
        sendButton.innerHTML = isLoading ? processingText : sendIcon;
        commandInput.disabled = isLoading;
    }
});
