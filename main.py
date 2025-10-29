import os
import requests
from dotenv import load_dotenv
from datetime import date
import pyperclip

class MediaAPI():
    def __init__(self):
        load_dotenv()
        self.api_key = os.environ.get('APIKEY')
        if not self.api_key:
            raise ValueError("API key not found. Make sure it's set in your environment variables.")
        
        self.base_url = "https://api.themoviedb.org/3"
        self.headers = {"accept": "application/json",  "Authorization": f"Bearer {self.api_key}"}
        self.IMDB_media_id = ""
        self.media_type = ""
        self.media_id = ""
        self.title = ""
        self.year = ""
        self.genre = ""
        self.runtime = ""
        self.director = ""
        self.season = 0
        self.episodes = 0

        self.get_imdb_id()

    def get_imdb_id(self):
        self.IMDB_media_id = input("IMDB id: ") #tt0944947  tt12637874
        #self.IMDB_media_id = "tt0944947" #testing tv show got // 1399 is themoviedb ID
        #self.IMDB_media_id = "tt2788316" #testing tv show shogun // 126308 is themoviedb ID
        #self.IMDB_media_id = "tt5875444" #testing tv show slow horses // 95480 is themoviedb ID
        self.get_IMDB_details()

    def get_IMDB_details(self):
        url = f"{self.base_url}/find/{self.IMDB_media_id}?external_source=imdb_id"
        response = requests.get(url, headers=self.headers)
        response_data = response.json()

        if response_data.get("movie_results"):
            self.media_type = "movie"
        elif response_data.get("tv_results"):
            self.media_type = "tv"
        else:
            print("ID not found")
            return
        
        self.media_id = response_data[f"{self.media_type}_results"][0]["id"]
        self.get_information()

    def get_information(self):
        today_date = None
        while today_date == None:
            try:
                today = input("Did you watch it today?\n[Yes] [No]\n")
                if(today.lower() == "yes"):
                    today_date = date.today()
                elif(today.lower() == "no"):
                    today_date = ""
            except ValueError:
                    print("Invalid input.")


        if self.media_type == "movie":
            self.get_movie_details()
            result = f"{self.title}\t{self.director}\t{self.year}\tCijfer\t{self.genre}\t{self.runtime}\tFormat\t{today_date}"
        elif self.media_type == "tv":
            self.get_tv_details()
            result = f"{self.title}\t{self.season}\t{self.year}\tCijfer\t{self.genre}\t{self.episodes}\tFormat\t{today_date}"


        print(result)
        self.write_to_file(result)

    def get_movie_details(self):
        url = f"{self.base_url}/movie/{self.media_id}?language=en-US"
        response = requests.get(url, headers=self.headers)
        response_data = response.json()
        self.title = response_data["original_title"]
        self.year = response_data["release_date"].split('-')[0]
        self.genre = "/".join(genre["name"] for genre in response_data["genres"])
        self.runtime = f"{response_data['runtime'] // 60}:{response_data['runtime'] % 60}"

        self.get_credits_details("Director")

    def get_tv_details(self):
        url = f"{self.base_url}/tv/{self.media_id}?language=en-US"
        response = requests.get(url, headers=self.headers)
        response_data = response.json()
        self.title = response_data["name"]
        max_seasons = 0
        isSpecial = False
        for i in response_data["seasons"]: #if there are specials that season is numbered as 0
            if i["season_number"] != 0:
                max_seasons += 1
            else:
                isSpecial = True
        if max_seasons == 1 : self.season = 1
        while max_seasons > 1:                
            try:
                self.season = int(input(f"Which season of {self.title} are you watching (1-{max_seasons}): "))           
                if self.season < 1 or self.season > max_seasons:
                    print("That season does not exist")
                else: 
                    break
            except ValueError:
                print("Invalid input. Please enter a number.")
   

        for i in response_data["seasons"]:
            if i["season_number"] == self.season:
                self.episodes = i["episode_count"]
        if isSpecial == True: #if there is a special season. the self.season is equal to the index, otherwise self.season - 1
            self.year = response_data["seasons"][self.season]["air_date"][:4]
        else:
             self.year = response_data["seasons"][self.season - 1]["air_date"][:4]
        self.genre = "/".join(genre["name"] for genre in response_data["genres"])




        


    def get_credits_details(self, job_title):
        url_credits = f"{self.base_url}/{self.media_type}/{self.media_id}/credits?language=en-US"
        response_credits = requests.get(url_credits, headers=self.headers)
        response_data_credits = response_credits.json()

        self.director = " & ".join(crew["name"] for crew in response_data_credits["crew"] if crew.get("job") == job_title)

    def write_to_file(self, result):
        with open("output.txt", "a") as file:
            pyperclip.copy(result)
            #file.write(result + "\n")
        # try:

        #     workbook = openpyxl.load_workbook('Movies&Tv - Copy.xlsx')
        #     worksheet = workbook['Movie List']
        #     #worksheet.insert_rows(43)
        #     data = result.split("\t")

        #     for column, value in enumerate(data, start=3):
        #             cell = worksheet.cell(row=43, column=column)
        #             cell.value = value

        #     workbook.save('Movies&Tv - Copy.xlsx')

        # except Exception as e:
        #     print("An error occurred:", e)
 


media_api = MediaAPI()
#wonka imdb:  tt6166392