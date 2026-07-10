import argparse
import json
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Local faster-whisper transcription helper.")
    parser.add_argument("--file", required=True)
    parser.add_argument("--model", default="small")
    parser.add_argument("--device", default="auto")
    parser.add_argument("--compute-type", default="auto")
    parser.add_argument("--language", default="tr")
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(
            json.dumps({
                "error": "Python package 'faster-whisper' is not installed. Run: python -m pip install faster-whisper"
            }, ensure_ascii=False),
            file=sys.stderr,
        )
        return 2

    model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)
    segments, info = model.transcribe(
        args.file,
        language=args.language,
        vad_filter=True,
        beam_size=5,
    )
    text = "\n".join(segment.text.strip() for segment in segments if segment.text.strip()).strip()
    print(json.dumps({
        "text": text,
        "language": getattr(info, "language", args.language),
        "duration": getattr(info, "duration", None),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
