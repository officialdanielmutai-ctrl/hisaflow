import os
import re

dir_path = r'e:\LEINTUM\Hisa Flow\apps\frontend\components'

def update_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # 1. Update SheetContent to add bg-[#FAFAFA]
    if '<SheetContent>' in content:
        content = content.replace('<SheetContent>', '<SheetContent className="bg-[#FAFAFA]">')
    else:
        def repl_sheet(match):
            cls = match.group(1)
            if 'bg-[' not in cls and 'bg-' not in cls:
                return f'<SheetContent className="{cls} bg-[#FAFAFA]">'
            return match.group(0)
        content = re.sub(r'<SheetContent className="([^"]+)">', repl_sheet, content)

    # 2. Update primary action buttons to have brand colors
    content = re.sub(r'<Button>([^<]+)</Button>', r'<Button className="bg-[#1F7A5A] hover:bg-[#1A6B4E] text-white">\1</Button>', content)
    
    def repl_btn(match):
        attrs = match.group(1)
        if 'className=' in attrs:
            if 'bg-[#1F7A5A]' not in attrs and 'variant=' not in attrs:
                attrs = re.sub(r'className="([^"]+)"', r'className="\1 bg-[#1F7A5A] hover:bg-[#1A6B4E] text-white"', attrs)
                return f'<Button {attrs}>'
        else:
             if 'variant=' not in attrs:
                 return f'<Button {attrs} className="bg-[#1F7A5A] hover:bg-[#1A6B4E] text-white">'
        return match.group(0)
        
    content = re.sub(r'<Button\s+([^>]+?)>', repl_btn, content)

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Updated {filepath}')

for root, dirs, files in os.walk(dir_path):
    for file in files:
        if file.endswith('Sheet.tsx'):
            update_file(os.path.join(root, file))
