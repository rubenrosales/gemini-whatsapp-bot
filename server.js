/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import express from "express";
import fetch from 'node-fetch'; // Import node-fetch

const app = express();
app.use(express.json());

const { WEBHOOK_VERIFY_TOKEN, GRAPH_API_TOKEN, GEMINI_API_KEY } = process.env;
const PORT = 3000;

const DICTIONARY_API_BASE_URL = "https://dictionary.kubishi.com";

async function translateToPaiute(englishWord) {
    try {
        const url = `${DICTIONARY_API_BASE_URL}/api/search/paiute?query=${encodeURIComponent(englishWord)}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`Dictionary API error: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
            return data; // Return the array of translations.
        } else {
            return null; // No translation found
        }

    } catch (error) {
        console.error("Error during dictionary API call:", error);
        return null;
    }
}

async function getWordDetails(wordId) {
    try {
        const url = `${DICTIONARY_API_BASE_URL}/api/word/${wordId}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`Dictionary API error: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error("Error during dictionary API call:", error);
        return null;
    }
}

async function searchEnglishWords(query) {
    try {
        const url = `${DICTIONARY_API_BASE_URL}/api/search/english?query=${encodeURIComponent(query)}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`Dictionary API error: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error("Error during dictionary API call:", error);
        return null;
    }
}

async function searchSentences(query) {
     try {
        const url = `${DICTIONARY_API_BASE_URL}/api/search/sentence?query=${encodeURIComponent(query)}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`Dictionary API error: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error("Error during dictionary API call:", error);
        return null;
    }
}

async function generateContent(prompt, useTools = true) {
    try {
        console.log("Prompt:", prompt);

        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        const tools = [
            {
                "function_declarations": [
                    {
                        "name": "translateToPaiute",
                        "description": "Use this function to translate English words to Paiute. It is critical for fulfilling translation requests. The input should ONLY be the exact English word to translate; nothing else. If the prompt contains multiple words, call this function multiple times.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "englishWord": {
                                    "type": "string",
                                    "description": "The English word to translate to Paiute. The value should be a SINGLE word only. For example: dog, cat, house.",
                                }
                            },
                            "required": ["englishWord"]
                        }
                    },
                    {
                        "name": "getWordDetails",
                        "description": "Use this function to retrieve detailed information about a specific word using its ID.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "wordId": {
                                    "type": "string",
                                    "description": "The ID of the word to retrieve details for.",
                                }
                            },
                            "required": ["wordId"]
                        }
                    },
                     {
                        "name": "searchEnglishWords",
                        "description": "Use this function to search for English words. It takes a query string as input.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "query": {
                                    "type": "string",
                                    "description": "The search query to find English words.",
                                }
                            },
                            "required": ["query"]
                        }
                    },
                    {
                        "name": "searchSentences",
                        "description": "Use this function to search for sentences that are relevant to the query.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "query": {
                                    "type": "string",
                                    "description": "The search query to find sentences.",
                                }
                            },
                            "required": ["query"]
                        }
                    }
                ]
            }
        ];

        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            tools: useTools ? tools : [], // Conditionally include tools
        };



        const response = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Gemini API Response:", data);

        let responseMessage = "Sorry, I couldn't extract a response from the Gemini API."; // Default message

        if (data && data.candidates && data.candidates.length > 0) {
            const candidate = data.candidates[0];
            console.log(candidate.content)
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0 &&  candidate.content.parts[0].text ) {
                responseMessage = candidate.content.parts[0].text; // Text response
                console.log("getting responseMessage")
            }

             if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0 && candidate.content.parts[0].functionCall) {
                const functionCall = candidate.content.parts[0].functionCall;
                 console.log("Function call detected:", functionCall);
                const functionName = functionCall.name;

                try {
                    const functionArgs = functionCall.args;

                    if (functionName === "translateToPaiute") {
                        const paiuteTranslations = await translateToPaiute(functionArgs.englishWord);

                        if (paiuteTranslations) {
                            let paiuteResponse = `Paiute translations for "${functionArgs.englishWord}":\n\n`;

                            paiuteTranslations.forEach((result, index) => {
                                paiuteResponse += `**Entry ${index + 1}:**\n`;
                                paiuteResponse += `Lexical Unit: ${result.lexical_unit}\n`;

                                if (result.senses && Array.isArray(result.senses) && result.senses.length > 0) {
                                    result.senses.forEach(sense => {
                                        paiuteResponse += `  Definition: ${sense.definition}\n`;
                                        paiuteResponse += `  Gloss: ${sense.gloss}\n`;
                                        paiuteResponse += `  Grammatical Info: ${sense.grammatical_info}\n`;

                                        if (sense.examples && Array.isArray(sense.examples) && sense.examples.length > 0) {
                                            paiuteResponse += "  Examples:\n";
                                            sense.examples.forEach(example => {
                                                paiuteResponse += `    Form: ${example.form}\n`;
                                                paiuteResponse += `    Translation: ${example.translation}\n`;
                                            });
                                        } else {
                                            paiuteResponse += "  No examples provided.\n";
                                        }
                                        paiuteResponse += "\n";
                                    });
                                } else {
                                    paiuteResponse += "  No senses (definitions) found for this entry.\n";
                                }
                                paiuteResponse += "---\n";
                            });

                            paiuteResponse = paiuteResponse.slice(0, -5);
                            responseMessage = paiuteResponse; // Override default message
                        } else {
                            responseMessage = `Could not find a Paiute translation for "${functionArgs.englishWord}".`; // Override default message
                        }
                    } else if (functionName === "getWordDetails") {
                        const wordDetails = await getWordDetails(functionArgs.wordId);

                        if (wordDetails) {
                            responseMessage = `Word Details for ID "${functionArgs.wordId}":\n\n`;
                            responseMessage += `Lexical Unit: ${wordDetails.lexical_unit || 'N/A'}\n`;
                            responseMessage += `Definition: ${wordDetails.definition || 'N/A'}\n`;
                        } else {
                            responseMessage = `Could not find word details for ID "${functionArgs.wordId}".`;
                        }
                    }  else if (functionName === "searchEnglishWords") {
                        const searchResults = await searchEnglishWords(functionArgs.query);

                        if (searchResults && Array.isArray(searchResults) && searchResults.length > 0) {
                            responseMessage = `Search results for English word "${functionArgs.query}":\n\n`;

                            for (const result of searchResults) {
                                responseMessage += `**Lexical Unit:** ${result.lexical_unit}\n`;
                                if (result.senses && Array.isArray(result.senses) && result.senses.length > 0) {
                                    for (const sense of result.senses) {
                                        responseMessage += `  **Definition:** ${sense.definition}\n`;
                                        responseMessage += `  **Gloss:** ${sense.gloss}\n`;
                                        responseMessage += `  **Grammatical Info:** ${sense.grammatical_info}\n`;

                                        if (sense.examples && Array.isArray(sense.examples) && sense.examples.length > 0) {
                                            responseMessage += `  **Examples:**\n`;
                                            for (const example of sense.examples) {
                                                responseMessage += `    Form: ${example.form}\n`;
                                                responseMessage += `    Translation: ${example.translation}\n`;
                                            }
                                        } else {
                                            responseMessage += `  No examples provided.\n`;
                                        }
                                    }
                                } else {
                                    responseMessage += `  No senses found for this entry.\n`;
                                }
                                responseMessage += `---\n`;
                            }
                            responseMessage = responseMessage.slice(0, -5); // Remove last '---'
                        } else {
                            responseMessage = `Could not find English words for query "${functionArgs.query}".`;
                        }
                    } else if (functionName === "searchSentences") {
                         const searchResults = await searchSentences(functionArgs.query);

                         if (searchResults && Array.isArray(searchResults) && searchResults.length > 0) {
                            responseMessage = `Search results for sentences "${functionArgs.query}":\n\n`;

                            for (const result of searchResults) {
                                responseMessage += `**Sentence:** ${result.sentence}\n`;
                                responseMessage += `**Translation:** ${result.translation}\n`;
                                responseMessage += `---\n`;
                            }
                             responseMessage = responseMessage.slice(0, -5); // Remove last '---'
                        } else {
                            responseMessage = `Could not find sentences for query "${functionArgs.query}".`;
                        }
                    }
                     else {
                        responseMessage = "Sorry, I don't know how to handle that function.";  // Override default message
                    }
                } catch (e) {
                    console.error("Error parsing function arguments", functionCall.parameters, e);
                    responseMessage = `Error processing arguments for function ${functionName}`; // Override default message
                }
            }
        } else {
            console.warn("Unexpected Gemini API response format:", data);
        }

        return responseMessage; // Return the determined response
    } catch (error) {
        console.error("Error generating content:", error);
        return "Sorry, I encountered an error while processing your request.";
    }
}

async function translateSentenceUsingTools(sentence) {
    const words = sentence.split(/\s+/); // Split the sentence into words
    let translatedSentence = "";

    for (const word of words) {
        // Generate content using Gemini API with tool use *for each word*
        const geminiResponse = await generateContent(`Translate "${word}" to Paiute.`, true);  // Ensure tool use

        translatedSentence += geminiResponse + " "; // Append translated word + space
    }

    return translatedSentence.trim(); // Return the combined translated sentence
}

async function searchSentencesUsingTool(query) {

    // Generate content using Gemini API with tool use, forcing "searchSentences"
    const geminiResponse = await generateContent(query, true);

    return geminiResponse; // Return the combined translated sentence
}

app.post("/webhook", async (req, res) => {
    // log incoming messages
    console.log("Incoming webhook message:", JSON.stringify(req.body, null, 2));

    // check if the webhook request contains a message
    const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];

    // check if the incoming message contains text
    if (message?.type === "text") {
        // extract the business number to send the reply from it
        const business_phone_number_id =
            req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;

        const userMessage = message.text.body;

        let messageBody = "";

        if (userMessage.startsWith("/translate")) {
            // Extract the sentence to translate
            const sentenceToTranslate = userMessage.substring("/translate".length).trim();

            if (sentenceToTranslate) {
                // Translate the sentence to Paiute using tools
                messageBody = await translateSentenceUsingTools(sentenceToTranslate);
            } else {
                messageBody = "Please provide a sentence to translate after the /translate command.";
            }
        } else if (userMessage.startsWith("/sentences")) {
            const sentenceQuery = userMessage.substring("/sentences".length).trim();

            if (sentenceQuery) {
                messageBody = await searchSentencesUsingTool(sentenceQuery);
            } else {
                messageBody = "Please provide a query to search for sentences after the /sentences command.";
            }
        } else {
            // Generate content using Gemini API
            const geminiResponse = await generateContent(userMessage);
            messageBody = geminiResponse || "Sorry, I couldn't generate a response.";
        }

        // Truncate the message if it exceeds the limit
        if (messageBody.length > 4096) {
            messageBody = messageBody.substring(0, 4090) + "...(truncated)";
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
                text: { body: messageBody },
                context: {
                    message_id: message.id, // shows the message as a reply to the original user message
                },
            }),
        });

        if (!facebookResponse.ok) {
            console.error('Error sending message:', facebookResponse.status, await facebookResponse.text());
        }

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
    res.send(`<pre>Nothing to see here.
Checkout README.md to start.</pre>`);
});

app.listen(PORT, () => {
    console.log(`Server is listening on port: ${PORT}`);
});
