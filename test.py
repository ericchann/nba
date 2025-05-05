import requests
import json

headers = {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'en,en-US;q=0.9',
    'dnt': '1',
    'origin': 'https://www.bettingpros.com',
    'priority': 'u=1, i',
    'referer': 'https://www.bettingpros.com/',
    'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    'x-api-key': 'CHi8Hy5CEE4khd46XNYL23dCFX96oUdw6qOt1Dnh'
}

# Request 1
params = {
    'sport': 'NBA',
    'market_id': '129',
    'event_id': '26434',
    'location': 'MA',
    'live': 'true',
    'limit': '5',
    'page': '1'
}
response = requests.get('https://api.bettingpros.com/v3/offers', headers=headers, params=params)
with open('response1.json', 'w') as f:
    json.dump(response.json(), f, indent=2)

# Request 2
params2 = {
    'sport': 'NBA',
    'market_id': '156:157:151:162:147:160:152:142:136:335:336:337:338',
    'player_slug': 'james-harden',
    'event_id': '26434',
    'location': 'MA',
    'limit': '5',
    'page': '1'
}
response2 = requests.get('https://api.bettingpros.com/v3/offers', headers=headers, params=params2)
with open('response2.json', 'w') as f:
    json.dump(response2.json(), f, indent=2)

# Request 3
params3 = {
    'sport': 'NBA',
    'market_id': '129',
    'event_id': '26432',
    'location': 'MA',
    'live': 'true',
    'limit': '5',
    'page': '1'
}
response3 = requests.get('https://api.bettingpros.com/v3/offers', headers=headers, params=params3)
with open('response3.json', 'w') as f:
    json.dump(response3.json(), f, indent=2)

# Print status codes
print(response.status_code)
print(response2.status_code)
print(response3.status_code)
