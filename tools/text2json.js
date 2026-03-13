#!/usr/bin/env node
const fs = require('fs');

if (process.argv.length < 4) {
    console.log("Kullanım: node text2json.js <girdi_metni.txt> <cikti_dosyasi.json>");
    process.exit(1);
}

const inputFile = process.argv[2];
const outputFile = process.argv[3];

const content = fs.readFileSync(inputFile, 'utf-8');
const lines = content.split('\n');

const result = {
    setName: "İsimsiz Set",
    questions: []
};

let currentQuestion = null;
let currentSubject = "Genel";
let capturingExplanation = false;
let explanationLines = [];

function processFormatting(text) {
    return text
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    if (line.startsWith('## ')) {
        result.setName = line.substring(3).trim();
        continue;
    }
    
    if (line.startsWith('### Konu:')) {
        currentSubject = line.substring(9).trim();
        continue;
    }
    
    if (line.startsWith('Soru:')) {
        if (currentQuestion) {
            if (capturingExplanation) {
                currentQuestion.explanation = explanationLines.join('<br>').trim();
            }
            result.questions.push(currentQuestion);
        }
        
        currentQuestion = {
            q: processFormatting(line.substring(5).trim()),
            options: [],
            correct: -1,
            explanation: "",
            subject: currentSubject
        };
        capturingExplanation = false;
        explanationLines = [];
        continue;
    }
    
    const optionMatch = line.match(/^([A-E])\)\s+(.+)$/);
    if (optionMatch && currentQuestion && !capturingExplanation) {
        currentQuestion.options.push(processFormatting(optionMatch[2].trim()));
        continue;
    }
    
    if (line.startsWith('Doğru Cevap:')) {
        const correctChar = line.substring(12).trim().toUpperCase();
        if (currentQuestion) {
            currentQuestion.correct = correctChar.charCodeAt(0) - 65;
        }
        continue;
    }
    
    if (line.startsWith('Açıklama:')) {
        capturingExplanation = true;
        let expText = line.substring(9).trim();
        explanationLines.push(processFormatting(expText));
        continue;
    }
    
    if (capturingExplanation) {
        explanationLines.push(processFormatting(line));
    }
}

if (currentQuestion) {
    if (capturingExplanation) {
        currentQuestion.explanation = explanationLines.join('<br>').trim();
    }
    result.questions.push(currentQuestion);
}

const dir = outputFile.substring(0, outputFile.lastIndexOf('/'));
if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf-8');
console.log(`Dönüştürme tamamlandı: ${result.questions.length} soru '${outputFile}' dosyasına kaydedildi.`);
