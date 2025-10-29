import csv 
import os
import requests
import uuid
import json
from dotenv import load_dotenv

#todo:
#1: print skiped movies at the end
#2: use user's data from csv file like score, watch date, format, comments

load_dotenv()  # Loads variables from .env into environment
api_key = os.getenv("APIKEY")
print("API KEY:", api_key)

def get_movie_data():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    movies = []
    with open("data/Movies.csv", 'r',  encoding="utf-8") as file:
        reader = csv.reader(file, delimiter=';')
        next(reader) #skip the header row
        for row in reader:
            #print(row[0]) 
            movie_id = get_movie_id(row[0])
            if not movie_id:
                continue
            movie_data = get_movie_details(movie_id)
            movie_data["score"] = 90
            user_movie_data = get_user_movie_data(row, movie_data)
            movie_data.update(user_movie_data)
            if movie_data:
                movies.append(movie_data)

            
            
    with open("movie-data.json", "w", encoding="utf-8") as json_file:
        json.dump(movies, json_file, ensure_ascii=False, indent=2)
    print("All movie data written to movies-output.json")
 


skipped_movies = []

def get_movie_id(title):
    url = f"https://api.themoviedb.org/3/search/movie?query={title}"
    headers = {
        "accept" : "application/json",
        "Authorization" : f"Bearer {api_key}"
    }
    response = requests.get(url, headers=headers)

 
    if response.status_code != 200:
        print (f"error {response.status_code}")
        return  # or break, if inside a loop

    data = response.json()
    original_title = data["results"][0]["original_title"]
    movie_title = data["results"][0]["title"]
    if title != movie_title or title != original_title:
        print(f"Title mismatch: Could not find exact match for '{title}'. Found '{movie_title}' (original: '{original_title}')")
        #skip this movie if it does not match with the first search result
        should_skip = input("Skip this movie? (y/n): ")
        if should_skip.lower() == 'y':
            skipped_movies.append(title)  # Add to array
            return
        
    movie_id = data["results"][0]["id"]
    print(f"Found movie: {movie_title} (ID: {movie_id})")
    return movie_id


def get_movie_details(movie_id):

    #get details
    url = f"https://api.themoviedb.org/3/movie/{movie_id}"
    headers = {
        "accept" : "application/json",
        "Authorization" : f"Bearer {api_key}"
    }
    response = requests.get(url, headers=headers)
    title = response.json()["title"]
    release_date = response.json()["release_date"]
    poster_path = response.json()["poster_path"]
    release_date = response.json()["release_date"]
    runtime = response.json()["runtime"]
    genres = [genre["name"] for genre in response.json()["genres"]]
    imdb_id = response.json()["imdb_id"]

    #get director
    url = f"https://api.themoviedb.org/3/movie/{movie_id}/credits"    

    response = requests.get(url, headers=headers)
    crew = response.json()["crew"]
    director = next((member["name"] for member in crew if member["job"] == "Director"), None)


    movie_data = {
        "id": movie_id,
        "entryId": str(uuid.uuid4()),
        "title": title,
        "poster_path": poster_path,
        "release_date": release_date,
        "runtime": runtime,
        "genres": genres,
        "imdb_id": imdb_id,
        "director": director,
   
    }
    return movie_data

def get_user_movie_data(row, movie_data): 
    #2: use user's data from csv file like score, watch date, format, comment
    day, month, year = row[7].split('-')
    formatted_date = f"{year.zfill(4)}-{month.zfill(2)}-{day.zfill(2)}"

    score_100 = int(row[3]) 
    if score_100 % 10 == 0:
       score = score_100 / 20
    else:
        print("this movie is not devided by 10, adjusting score")
        print("original score:", row[3])
        print("Movie title:", movie_data["title"])
        imdb_url = f"https://www.imdb.com/title/{movie_data['imdb_id']}/"
        print(f"IMDb link: {imdb_url}")
        new_score = input("Please enter new score out of 5:  ")
        score = new_score

    user_movie_date = {
    "userRating":score,
    "watchDate": formatted_date,
    "format": row[6],
    "comment": row[9],
    "isRewatch": row[8] == "X"
    }

    return user_movie_date

    

    #id, entryid, title, poster_path, release_date, runtime, genres[], , imdb_id
    #director




     
    


if __name__ == "__main__":
    get_movie_data()
    print("Skipped movies:", skipped_movies)





# Read your CSV file in Python.
# For each row, use the title (and maybe year) to fetch data from TMDB.
# Merge your own data with the TMDB data.
# Write the result to a JSON file.d







