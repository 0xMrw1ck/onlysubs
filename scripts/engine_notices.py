from importlib import metadata
from pathlib import Path
import sys

packages = ['faster-whisper','ctranslate2','huggingface-hub','tokenizers','av','numpy','onnxruntime','tqdm','PyYAML','protobuf','flatbuffers','httpx','httpcore','anyio','certifi','filelock','fsspec','packaging','click','idna','h11','typing-extensions','pyinstaller']
parts = ['onlysubs bundled transcription engine — third-party notices', 'The program is assembled with PyInstaller and includes a Python runtime. Package licences remain with their respective authors. Model weights are not included and have their own model-card licence.']
for name in packages:
    try:
        dist = metadata.distribution(name)
    except metadata.PackageNotFoundError:
        continue
    license_name = dist.metadata.get('License-Expression') or dist.metadata.get('License') or 'See included licence text and project metadata'
    parts.append(f"\n{'-'*72}\n{name} {dist.version}\nLicence: {license_name}\nProject: {dist.metadata.get('Home-page') or dist.metadata.get('Project-URL') or 'See Python package metadata'}")
    seen = set()
    for file in dist.files or []:
        if not any(part.lower().startswith(('license','copying','notice')) for part in Path(file).parts):
            continue
        full = Path(dist.locate_file(file))
        if full.is_file() and full not in seen:
            seen.add(full)
            try:
                parts.append(f"\n[{file}]\n{full.read_text(encoding='utf-8', errors='replace')}")
            except OSError:
                pass
Path(sys.argv[1]).write_text('\n'.join(parts), encoding='utf-8')
