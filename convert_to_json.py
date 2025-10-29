import pandas as pd
from datetime import datetime

def split_directors(director_str):
    # Split directors by "&" sign and strip spaces
    directors = [director.strip() for director in director_str.split('&')]
    return directors

def timestamp_to_date(timestamp):
    # Check if timestamp is not empty
    if not pd.isnull(timestamp):
        # Format the datetime object as "YYYY-MM-DD"
        return timestamp.strftime('%d-%m-%Y')

try:
    # Read the specific sheet 'Movie List' from the Excel file into a DataFrame
    df = pd.read_excel('Movies&Tv.xlsx', sheet_name='Movie List')

    # Add an 'ID' column
    df['ID'] = df.index + 1

    # Convert 'YEAR' column to integers and round them
    df['YEAR'] = df['YEAR'].fillna(0).astype(int)

    # Convert 'Rewatch' column to boolean
    df['REWATCH'] = df['REWATCH'].fillna('').astype(bool)

    # Split the 'GENRE' column into a list
    df['GENRE'] = df['GENRE'].fillna('').apply(lambda x: x.split('/') if x else [])

    # Split the 'DIRECTOR' column into separate entries
    df['DIRECTOR'] = df['DIRECTOR'].fillna('').apply(split_directors)

    # Convert 'DATE' column from Unix timestamp to date string
    df['DATE'] = df['DATE'].apply(timestamp_to_date)

    # Define the column names for the JSON object (excluding 'NO.')
    columns = ['ID', 'TITLE', 'DIRECTOR', 'YEAR', 'REVIEW', 'GENRE', 'Runtime', 'FORMAT', 'DATE', 'REWATCH', 'COMMENTS']

    # Convert DataFrame to a list of dictionaries, each representing an item
    items = []
    for _, row in df.iterrows():
        item = {}
        for col in columns:
            item[col] = row[col]
        items.append(item)

    # Convert the list of dictionaries to JSON with indentation for readability
    json_data = pd.Series(items).to_json(orient='records', indent=4)

    # Write the JSON data to a file
    with open('output.json', 'w') as json_file:
        json_file.write(json_data)

    print("JSON data saved to 'output.json'.")

except Exception as e:
    print("An error occurred:", e)
