import argparse, json, os, sys

parser = argparse.ArgumentParser()
parser.add_argument('audio', nargs='?')
parser.add_argument('output', nargs='?')
parser.add_argument('--model', default='small')
parser.add_argument('--cache-dir')
parser.add_argument('--health', action='store_true')
args = parser.parse_args()
try:
    from faster_whisper import WhisperModel
    if args.health:
        print(json.dumps({'ready': True, 'engine': 'faster-whisper'}))
        raise SystemExit(0)
    if not args.audio or not args.output:
        parser.error('audio and output are required')
    if args.cache_dir:
        os.makedirs(args.cache_dir, exist_ok=True)
    model = WhisperModel(args.model, device='cpu', compute_type='int8', download_root=args.cache_dir)
except Exception as error:
    print('Transcription engine error: ' + str(error), file=sys.stderr)
    raise
segments, _ = model.transcribe(args.audio, vad_filter=True, word_timestamps=True)
with open(args.output, 'w', encoding='utf-8') as out:
    json.dump({'segments': [{'start': s.start, 'end': s.end, 'text': s.text, 'words': [{'start':w.start,'end':w.end,'word':w.word.strip()} for w in (s.words or [])]} for s in segments]}, out)
