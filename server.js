import express from "express";
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

const { WEBHOOK_VERIFY_TOKEN, GRAPH_API_TOKEN, GEMINI_API_KEY } = process.env;
const PORT = 3000;


async function callGeminiAPI(prompt, systemPrompt = "") {
    try {
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;


        const tools = {
            "tools": [
                {
                    "function_declarations": [
                        {
                            "name": "getWordById",
                            "description": "Retrieve details of a specific word.",
                            "parameters": {
                                "type": "object",
                                "properties": {
                                    "word_id": {
                                        "type": "string",
                                        "description": "The ID of the word to retrieve."
                                    }
                                },
                                "required": [
                                    "word_id"
                                ]
                            }
                        },
                        {
                            "name": "searchEnglish",
                            "description": "Search for English words.",
                            "parameters": {
                                "type": "object",
                                "properties": {
                                    "query": {
                                        "type": "string",
                                        "description": "Search query for English words."
                                    }
                                },
                                "required": [
                                    "query"
                                ]
                            }
                        },
                        {
                            "name": "searchPaiute",
                            "description": "Search for Paiute words.",
                            "parameters": {
                                "type": "object",
                                "properties": {
                                    "query": {
                                        "type": "string",
                                        "description": "Search query for Paiute words."
                                    }
                                },
                                "required": [
                                    "query"
                                ]
                            }
                        },
                        {
                            "name": "searchSentence",
                            "description": "Search for sentences.",
                            "parameters": {
                                "type": "object",
                                "properties": {
                                    "query": {
                                        "type": "string",
                                        "description": "Search query for sentences."
                                    }
                                },
                                "required": [
                                    "query"
                                ]
                            }
                        }
                    ]
                }
            ]
        };
        let contents = [{ parts: [{ text: prompt }] }];
        let requestBody = {
            contents: contents,
            tools: tools.tools
        };

        const _systemPrompt = `You are an autonomous language assistant specializing in English and Paiute. Your primary function is to use available tools, specifically functions that interface with the Kubishi Dictionary API, to assist users with language-related tasks for both languages.User inputs may be vague try to use function calls as much as you can to help them out.
Dont forget that inputs do not have be exact, so think of these tools also as a fuzzy searcher. Eg. "how do you say im going to the store with my dog?" should search the searchSentence endpoint.
**You have access to the following functions (tools) to interact with the Kubishi Dictionary API:**

- **getWordById(word_id: string)**: Retrieves details of a specific word given its ID.
- **searchEnglish(query: string)**: Searches for English words matching the query.
- **searchPaiute(query: string)**: Searches for Paiute words matching the query.
- **searchSentence(query: string)**: Searches for sentences matching the query.

When the user asks a question related to English or Paiute language, determine if one of these functions can help answer the question. If so, use the function call in your response.  If you can answer directly without using tools, you can also do that.`;


        if (_systemPrompt) {
            requestBody["systemInstruction"] = {
                "parts": [
                    {
                        "text": _systemPrompt
                    }
                ]
            }
        }


        // console.log("Gemini Request Body:", JSON.stringify(requestBody, null, 2));

        const response = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        // console.log("Gemini API Response:", JSON.stringify(data, null, 2));
        return data;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return null;
    }
}

async function getWordById(word_id) {
    const baseUrl = "https://dictionary.kubishi.com";
    const endpoint = `/api/word/${word_id}`;
    const url = baseUrl + endpoint;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) {
                return { error: "Word not found" };
            }
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        // Only return the relevant data, according to the API spec
        return {
            lexical_unit: data.lexical_unit,
            definition: data.definition,
            id: data.id
        };
    } catch (error) {
        console.error(`Error in getWordById:`, error);
        return { error: "Failed to retrieve word details" };
    }
}

async function searchEnglish(query) {
    return await searchWords("english", query);
}

async function searchPaiute(query) {
    return await searchWords("paiute", query);
}

async function searchSentence(query) {
    return await searchWords("sentence", query);
}

async function searchWords(language, query) {
    const baseUrl = "https://dictionary.kubishi.com";
    const endpoint = `/api/search/${language}?query=${encodeURIComponent(query)}`;
    const url = baseUrl + endpoint;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 400) {
                return "Please provide a word to search for."; // User-friendly 400 error
            }
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();

        if (!data || data.length === 0) {
            return `I couldn't find any results for "${query}" in ${language}.`;
        }

        let formattedResponse = `Here are the results for "${query}":\n\n`;

        if (language == "sentence"){
        data.forEach((entry, index) => {
            formattedResponse += `**${index + 1}. ${entry.sentence}***\n`;

            // if (entry.traits && entry.traits['morph-type']) {
            //     formattedResponse += ` *(${entry.traits['morph-type']})*\n`;
            // } else {
            //     formattedResponse += "\n";
            // }
          console.log(entry)
          console.log("________")
          
                    const translation = entry.translation
                    if(translation){
                        formattedResponse += `   - Translation: ${translation}\n`;

                    }
                    const notes = entry.notes 
                    if (notes)
                    {
                        formattedResponse += `   - Notes: ${notes}\n`;

                    }
            if (entry.senses && entry.senses.length > 0) {
                entry.senses.forEach((sense, senseIndex) => {
                    // Handle both array and object formats for senses.  Crucial!
//                     const sentence = sense.sentence || (sense[0] && sense[0].sentence);
//                     if (sentence) {
//                          formattedResponse += `   - Sentence: ${sentence}\n`;
//                     }
                  
                    const translation = sense.translation || (sense[0] && sense[0].translation);
                    if(translation){
                        formattedResponse += `   - Translation: ${translation}\n`;

                    }
                    const notes = sense.notes || (sense[0] && sense[0].notes);
                    if (notes)
                    {
                        formattedResponse += `   - Notes: ${notes}\n`;

                    }



                });
            }


            formattedResponse += "\n";
        });

        }
      
      else{
        
                data.forEach((entry, index) => {
            formattedResponse += `**${index + 1}. ${entry.lexical_unit}**`;

            if (entry.traits && entry.traits['morph-type']) {
                formattedResponse += ` *(${entry.traits['morph-type']})*\n`;
            } else {
                formattedResponse += "\n";
            }

            if (entry.senses && entry.senses.length > 0) {
                entry.senses.forEach((sense, senseIndex) => {
                    // Handle both array and object formats for senses.  Crucial!
                    const definition = sense.definition || (sense[0] && sense[0].definition);
                    if (definition) {
                         formattedResponse += `   - Definition: ${definition}\n`;
                    }
                  
                    const gloss = sense.gloss || (sense[0] && sense[0].gloss);
                    if(gloss){
                        formattedResponse += `   - Gloss: ${gloss}\n`;

                    }
                    const examples = sense.examples || (sense[0] && sense[0].examples);
                    if (examples && Array.isArray(examples))
                    {
                        examples.forEach((example,exindex) =>
                        {
                            formattedResponse += `   - Example ${exindex+1}: ${example.form}\n`;
                            if(example.translation)
                            {
                                formattedResponse += `       Translation: ${example.translation}\n`;
                            }


                        });
                    }



                });
            }


            formattedResponse += "\n";
        });


        
      }

        return formattedResponse;


    } catch (error) {
        console.error(`Error in search${language.charAt(0).toUpperCase() + language.slice(1)}:`, error);
        return `Sorry, I encountered an error while searching for "${query}" in ${language}.`; // User-friendly error
    }
}

async function executeFunctionCall(functionCall) {
    const { name, args } = functionCall;

    switch (name) {
        case 'getWordById':
            return await getWordById(args.word_id);
        case 'searchEnglish':
            return await searchEnglish(args.query);
        case 'searchPaiute':
            return await searchPaiute(args.query);
        case 'searchSentence':
            return await searchSentence(args.query);
        default:
            return { error: `Unknown function: ${name}` };
    }
}


async function processGeminiResponse(data) {
    if (!data || !data.candidates || data.candidates.length === 0) {
        console.warn("No candidates in Gemini API response.");
        return "Sorry, I couldn't get a valid response.";
    }

    const candidate = data.candidates[0];
    const content = candidate.content;

    if (!content || !content.parts || content.parts.length === 0) {
        console.warn("No content parts in Gemini API response.");
        return "Sorry, the response was empty.";
    }

    for (const part of content.parts) {
        if (part.functionCall) {
            const functionCall = part.functionCall;
            console.log("Function call detected:", functionCall);
            const functionResult = await executeFunctionCall(functionCall);
            return functionResult; // Return the result of the function call
        } else if (part.text) {
            return part.text; // Direct text response
        }
    }

    console.warn("Unexpected Gemini API response format:", data);
    return "Sorry, I couldn't understand the response.";
}


// --- Message Handling ---
async function handleUserMessage(userMessage, systemPrompt = "") {
    const geminiData = await callGeminiAPI(userMessage, systemPrompt);
    if (!geminiData) return "Sorry, I couldn't process your request.";

    return await processGeminiResponse(geminiData);
}

// --- Express Routes ---
app.post("/webhook", async (req, res) => {
    console.log("Incoming webhook message:", JSON.stringify(req.body, null, 2));

    const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];

    if (message?.type === "text") {
        const business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
        const userMessage = message.text.body;

        // Add your system prompt here if you like, it will apply to all messages
        const systemPrompt = "You are a helpful assistant.";

        let response = await handleUserMessage(userMessage, systemPrompt);
        let responseMessage = "";

        if (typeof response === 'string') {
            responseMessage = response;
        } else if (typeof response === 'object') {
            // Pretty-print JSON response and remove unnecessary metadata
            responseMessage = JSON.stringify(response, null, 2);
        } else {
            responseMessage = "Unexpected response format from Gemini and function execution.";
        }


        if (responseMessage.length > 4096) {
            responseMessage = responseMessage.substring(0, 4090) + "...(truncated)";
        }

        const facebookApiUrl = `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`;

        const facebookResponse = await fetch(facebookApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GRAPH_API_TOKEN}`,
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: message.from,
                text: { body: responseMessage },
                context: {
                    message_id: message.id,
                },
            }),
        });

        if (!facebookResponse.ok) {
            console.error('Error sending message:', facebookResponse.status, await facebookResponse.text());
        }


        // Mark as read
        const readStatusApiUrl = `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`;
        const readStatusResponse = await fetch(readStatusApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GRAPH_API_TOKEN}`,
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                status: "read",
                message_id: message.id,
            }),
        });

        if (!readStatusResponse.ok) {
            console.error('Error marking message as read:', readStatusResponse.status, await readStatusResponse.text());
        }
    }

    res.sendStatus(200);
});

app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
        res.status(200).send(challenge);
        console.log("Webhook verified successfully!");
    } else {
        res.sendStatus(403);
    }
});

app.get("/", (req, res) => {
    res.send(`<pre>Nothing to see here. Checkout README.md to start.</pre>`);
});

app.listen(PORT, () => {
    console.log(`Server is listening on port: ${PORT}`);
});
