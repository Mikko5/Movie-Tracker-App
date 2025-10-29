// Fetch the data and process it
fetch('data/movie.json')
    .then(response => response.json())
    .then(data => { 
        const year = getYearFromUrl() || new Date().getFullYear(); // Default to current year if no year is provided
        const filteredData = FilterData(data,year)
        console.log(year)
        buildTable(filteredData);
        getMoviesByYear(filteredData,year);
        getDayofWeek(filteredData);
    })
    .catch(e => console.error('Error fetching JSON:', e));


function FilterData(data,targetYear)
{
    let filteredData = data.filter(movie => {    
        const date = movie["DATE"];
        const year = date.slice(-4);
        //return year == targetYear
        return targetYear == year 
    });
    // filteredData = filteredData.filter(movie => { //rewatch filter
    //    const rewatch = movie["REWATCH"]
    //    return rewatch == true 
    // });
    return filteredData
}

// Function to build the table
function buildTable(data) {
    const table = document.querySelector('table');

    // Create table header
    const headerRow = table.insertRow(-1);
    Object.keys(data[0]).forEach(key => {
        const headerCell = document.createElement('th');
        headerCell.textContent = key.toUpperCase();
        headerRow.append(headerCell);
    });

    // Populate table rows
    data.forEach(movie => {
        const row = table.insertRow(-1);
        Object.values(movie).forEach(value => {
            const cell = row.insertCell(-1);
            cell.textContent = value;
        });
    });
}

// Function to determine if a year is a leap year
function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

// Function to get movies by year
function getMoviesByYear(data, targetYear) {
    
    // Calculate the number of movies in the specified year
    let totalMovies = Object.keys(data).length;


    // Get the current date and calculate the day of the year
    const today = new Date();
    let dayOfYear = 0;

    if (targetYear != today.getFullYear()) {
        // If the year is not the current year, check if it is a leap year
        dayOfYear += isLeapYear(targetYear) ? 366 : 365;     
    
    } else {
        // Calculate the day of the year for the current year
        const startOfYear = new Date(targetYear, 0, 0);
        const diff = today - startOfYear;
        const oneDay = 1000 * 60 * 60 * 24;
        dayOfYear += Math.floor(diff / oneDay);
    }

    const moviesPerMonth = (totalMovies / (dayOfYear / 30.44)).toFixed(2);
    const moviesPerWeek = (totalMovies / (dayOfYear / 7)).toFixed(2);

    // Update the HTML content
    const summary = `Movies for the year ${targetYear}. Total: ${totalMovies}. Average per month: ${moviesPerMonth}. Average per week: ${moviesPerWeek}`;
    document.getElementById('MovieAverage').innerHTML = summary;
}


function getDayofWeek(data)
{
    console.log(new Date("2024/06/02").getDay())// get number of day. maandag = 1, dinsdag = 2, woensdag = 3 enz..
     const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    let dayCounts = {
        1: 0, // Monday
        2: 0, // Tuesday
        3: 0, // Wednesday
        4: 0, // Thursday
        5: 0, // Friday
        6: 0,  // Saturday
        0: 0, // Sunday
    };
    for (let movie of data) {
        const [day, month, year] = movie["DATE"].split('-');
        const newDate = new Date(year, month - 1, day);
        dayCounts[newDate.getDay()] += 1;
    }
    console.log(dayCounts )


    for(i in dayCounts ){          
            console.log(daysOfWeek[i] +": "+ dayCounts[i])
    }

}

// Function to get the year from the URL query string
function getYearFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('year');
}



//eerst data selecteren op basis van filter: e.g year, date, director, genre
// dan pas de colum maken en de getMoviesByYear functie oproepen


//todo select all years