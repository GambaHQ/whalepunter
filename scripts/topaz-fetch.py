"""
Topaz API Python Bridge
Fetches greyhound racing data from GRV Topaz API and outputs JSON to stdout.
Called from TypeScript via child_process.

Usage:
  python topaz-fetch.py month <year> <month>   - Fetch all runs for a month
  python topaz-fetch.py day <YYYY-MM-DD>        - Fetch all runs for a day

Requires: pip install topaz_api
Environment: TOPAZ_API_KEY must be set
"""
import sys
import os
import json

def main():
    api_key = os.environ.get("TOPAZ_API_KEY")
    if not api_key:
        print(json.dumps({"error": "TOPAZ_API_KEY environment variable not set"}))
        sys.exit(1)

    try:
        from topaz import TopazAPI
    except ImportError:
        print(json.dumps({"error": "topaz_api package not installed. Run: pip install topaz_api"}))
        sys.exit(1)

    api = TopazAPI(api_key)

    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: topaz-fetch.py month <year> <month> | day <YYYY-MM-DD>"}))
        sys.exit(1)

    mode = sys.argv[1]

    try:
        if mode == "month":
            year = int(sys.argv[2])
            month = int(sys.argv[3])
            data = api.get_bulk_runs_by_month(year, month)
        elif mode == "day":
            date_str = sys.argv[2]
            data = api.get_bulk_runs_by_day(date_str)
        else:
            print(json.dumps({"error": f"Unknown mode: {mode}. Use 'month' or 'day'"}))
            sys.exit(1)

        # Convert to JSON-safe format
        if hasattr(data, 'to_dict'):
            result = data.to_dict(orient='records')
        elif hasattr(data, 'to_json'):
            result = json.loads(data.to_json(orient='records'))
        elif isinstance(data, list):
            result = data
        else:
            result = list(data) if data else []

        print(json.dumps({"runs": result, "count": len(result)}))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
