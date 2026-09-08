import argparse, json
from faster_whisper import WhisperModel

parser = argparse.ArgumentParser()
parser.add_argument('audio')
parser.add_argument('output')
parser.add_argument('--model', default='small')
args = parser.parse_args()
model = WhisperModel(args.model, device='cpu', compute_type='int8')
segments, _ = model.transcribe(args.audio, vad_filter=True, word_timestamps=True)
with open(args.output, 'w', encoding='utf-8') as out:
    json.dump({'segments': [{'start': s.start, 'end': s.end, 'text': s.text, 'words': [{'start':w.start,'end':w.end,'word':w.word.strip()} for w in (s.words or [])]} for s in segments]}, out)
