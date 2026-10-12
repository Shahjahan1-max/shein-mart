import pandas as pd
import json
import glob

# सभी csv फाइलों को एक साथ पढ़कर JSON बनाना
all_files = glob.glob("*.csv")
final_json = {}

for filename in all_files:
    df = pd.read_csv(filename)
    key = filename.replace(".csv", "")
    final_json[key] = df.to_dict(orient='records')

with open('all_ads.json', 'w') as f:
    json.dump(final_json, f, indent=4)