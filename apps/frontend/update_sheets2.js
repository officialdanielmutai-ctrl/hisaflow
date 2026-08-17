const fs = require('fs');
const path = require('path');

const dirPath = path.join(__dirname, 'components');

function updateFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;

    // 1. Update Shadcn <SheetContent>
    if (content.includes('<SheetContent>')) {
        content = content.replace(/<SheetContent>/g, '<SheetContent className="bg-[#FAFAFA]">');
    } else {
        content = content.replace(/<SheetContent className="([^"]+)">/g, (match, p1) => {
            if (!p1.includes('bg-[#FAFAFA]')) {
                return `<SheetContent className="${p1.replace(/bg-white/g, '').replace(/bg-background/g, '').trim()} bg-[#FAFAFA]">`;
            }
            return match;
        });
    }

    // 2. Update custom portal backgrounds
    content = content.replace(/background:\s*['"]#ffffff['"]/g, "background: '#FAFAFA'");
    content = content.replace(/background:\s*['"]#fff['"]/g, "background: '#FAFAFA'");
    content = content.replace(/background:\s*['"]white['"]/g, "background: '#FAFAFA'");
    content = content.replace(/className="([^"]*)bg-white([^"]*)"/g, 'className="$1bg-[#FAFAFA]$2"');

    // 3. Update Shadcn <Button>
    content = content.replace(/<Button([^>]*)>/g, (match, p1) => {
        // Skip if variant is specified (e.g. variant="outline" or variant="ghost")
        if (p1.includes('variant=')) return match;
        // Skip if it's already styled with brand color
        if (p1.includes('bg-[#1F7A5A]') || p1.includes('bg-[var(--color-primary)]')) return match;

        if (p1.includes('className="')) {
            return `<Button${p1.replace('className="', 'className="bg-[#1F7A5A] hover:bg-[#1A6B4E] text-white ')}>`;
        } else {
            return `<Button${p1} className="bg-[#1F7A5A] hover:bg-[#1A6B4E] text-white">`;
        }
    });

    // 4. Update custom portal <button type="submit">
    content = content.replace(/<button\s+type="submit"([^>]*)style={{([^}]*)}}([^>]*)>/g, (match, p1, p2, p3) => {
        if (p2.includes('var(--color-primary)')) {
            // It's already using the primary color
            return match;
        }
        // Inject background color if missing
        if (!p2.includes('background:')) {
            const newStyle = p2 + ", background: 'var(--color-primary)', color: '#ffffff'";
            return `<button type="submit"${p1}style={{${newStyle}}}${p3}>`;
        }
        return match;
    });

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Updated ${filePath}`);
    }
}

function walkDir(currentPath) {
    const files = fs.readdirSync(currentPath);
    for (const file of files) {
        const fullPath = path.join(currentPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('Sheet.tsx') || fullPath.endsWith('Panel.tsx')) {
            updateFile(fullPath);
        }
    }
}

walkDir(dirPath);
