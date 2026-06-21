const fs = require('fs');
const path = require('path');

function fixDir(dir) {
    for (const f of fs.readdirSync(dir)) {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) {
            fixDir(full);
        } else {
            let content = fs.readFileSync(full, 'utf-8');
            if (content.startsWith('"') && content.endsWith('"')) {
                try {
                    content = JSON.parse(content);
                } catch(e) {
                    // Fallback
                    content = content.replace(/^"|"$/g, '').replace(/\\n/g, '\n').replace(/\\"/g, '"');
                }
                fs.writeFileSync(full, content);
            }
        }
    }
}
fixDir('c:/Users/נחמיה/Downloads/summer-app/temp-extract');
console.log('Fixed extracted files');
