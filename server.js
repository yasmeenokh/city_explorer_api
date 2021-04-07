'use strict';

require( 'dotenv' ).config();
// To access the express library and to be able to use it, from the node.js.
const express = require( 'express' );
const server = express();

// To specify which clients have the permission to send requests to our server.
const cors = require( 'cors' );
// To make it public.
server.use( cors() );

const superAgent = require( 'superagent' );
const pg = require( 'pg' );

const client = new pg.Client( { connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
} );

const PORT = process.env.PORT || 5000;

// Calling our routs and their functions; note that the errorHandler must always be the last one.
server.get( '/', homeHandler );
server.get( '/location', locationHandler );
server.get( '/weather', weatherHandler );
server.get( '/parks', parksHandler );
server.get( '/movies', moviesHandler );
server.get( '/yelp', yelpHandler );
server.get( '*', errorHandler );


// Handling Routs
function homeHandler( request, response ) {
  response.send( 'The server is working' );
}
// localhost:3030/location?city=amman
function locationHandler( request, response ) {
  // in order to know our request parameters we can console.log(request.query)
  let city = request.query.city;
  // First we are checking if the data is already saved in our dataBase
  let SQL = 'SELECT * FROM locations WHERE search_query = $1';
  // This is the $1 value, this step is only added for safety issues
  let safeValues = [city];
  console.log( safeValues );
  // To get the required data
  client.query( SQL, safeValues )
  // We are here first checking if the data is already present in our DB then send it from the DB and not from the API server;
  // ie don't hit the API server and get the data from the DB
    .then ( results =>{
      if( results.rows.length > 0 ){
        response.send( results.rows[0] );
        console.log( 'This is from the dataBase', results.rows );
      }else{
        let key = process.env.LOCATION_KEY;
        let locURL = `https://eu1.locationiq.com/v1/search.php?key=${key}&q=${city}&format=json`;
        superAgent.get( locURL )
          .then( geoData => {
            let apiData = geoData.body;
            // console.log( apiData );
            let locationData = new Location( city, apiData );
            response.send( locationData );
            console.log( 'This is from the API server', locationData );
          } );
      }
    } );
}
// localhost:3030/location?search_query=amman
function weatherHandler( request, response ) {
  let city = request.query.search_query;
  let key = process.env.WEATHER_KEY;
  // console.log( key );
  let weatherURL = `https://api.weatherbit.io/v2.0/forecast/daily?days=8&city=${city}&key=${key}`;
  superAgent.get( weatherURL )
    .then( weatherData => {
      let apiData = weatherData.body;
      // we are using map here because we have to get the weather for 8 days.
      let results = apiData.data.map( element => new Weather( element ) );
      response.send( results );
    } );

}
// localhost:3030/location?search_query=seattle
function parksHandler( request, response ) {
  let city = request.query.search_query;
  let key = process.env.PARK_KEY;
  let parkURL = `https://developer.nps.gov/api/v1/parks?q=${city}&api_key=${key}`;
  superAgent.get( parkURL )
    .then( parkData=>{
      let apiData = parkData.body;
      console.log( apiData );
      // we are using map here because we have to get the parks data for all the parks in that city.
      let results = apiData.data.map( element => new Park( element ) );
      response.send( results );
    } );
}
// localhost:3030/location?search_query=seattle
function moviesHandler( request, response ){
  let city = request.query.search_query;
  let key = process.env.MOVIES_KEY;
  let moviesURL = `https://api.themoviedb.org/3/search/movie?api_key=${key}&query=${city}`;
  superAgent.get( moviesURL )
    .then( movieData =>{
      let apiData = movieData.body;
      console.log( apiData );
      let result = apiData.results.map( element=> new Movie ( element ) );
      response.send( result );
    } );
}
// localhost:3030/location?search_query=seattle&page=2
function yelpHandler( request, response ){
  let city = request.query.search_query;
  let page = request.query.page;
  let key = process.env.YELP_KEY;
  // To determine how many items to be shown within the page
  let numPerPage = 5;
  // To calculate from which item the rendering should start from
  let start = ( ( page - 1 ) * numPerPage );
  let yelpURL = `https://api.yelp.com/v3/businesses/search?location=${city}&limit=${numPerPage}&offset=${start}`;
  superAgent.get( yelpURL )
  // This is from the documentation, so we are sending the API key to the header, and not within the url.
    .set( 'Authorization', `Bearer ${key}` )
    .then( yelpData=>{
      let apiData = yelpData.body;
      console.log( apiData );
      let result = apiData.businesses.map( element=> new Yelp ( element ) );
      response.send( result );
    } );
}

// Constructors
// note that each constructors is constructed according to form of data sent from the API server, 
// each API server sends the data in a different form then the other
function Yelp ( data ){
  this.name = data.name;
  this.image_url = data.image_url;
  this.price = data.price;
  this.rating = data.rating;
  this.url = data.url;
}

function Movie ( data ){
  this.title = data.original_title;
  this.overview = data.overview;
  this.average_votes = data.vote_average;
  this.total_votes = data.vote_count;
  this.image_url = `https://image.tmdb.org/t/p/w500/${data.poster_path}`;
  this.popularity = data.popularity;
  this.released_on = data.release_date;
}

function Location( city, data ) {
  this.search_query = city;
  this.formatted_query = data[0].display_name;
  this.latitude = data[0].lat;
  this.longitude = data[0].lon;
  // In order to add the API data to our server we use insert, in this way when a new request is done and a
  // new data is retrieved, it will be added to the DB
  let SQL = 'INSERT INTO locations (search_query,formatted_query,latitude,longitude) VALUES ($1,$2,$3,$4) RETURNING *;';
  let safeValues = [this.search_query,this.formatted_query,this.latitude,this.longitude];
  console.log( safeValues );
  client.query( SQL, safeValues )
    .then( results=>{
      console.log( 'Adding the data to the DB table', results.rows );
      return( results.rows );
    } );

}

function Weather( data ) {
  this.forecast = data.weather.description;
  this.time = data.datetime;
}

function Park( data ){
  this.name = data.fullName;
  // this.address = Object.values( data.addresses[0] );
  this.address = `${data.addresses[0].postalCode}, ${data.addresses[0].city}, ${data.addresses[0].stateCode}, ${data.addresses[0].line1}`;
  this.fee = data.entranceFees[0].cost;
  this.description = data.description;
  this.url = data.url;
}

function errorHandler( request, response ) {
  let errorObj = {
    status: 500,
    responseText: 'Sorry, something went wrong'
  };
  response.status( 500 ).send( errorObj );
}

// First we are making sure that our dataBase is connected properly, and then afterwards activating the server's listener.
client.connect()
  .then( () => {
    server.listen( PORT, () =>
      console.log( `listening on ${PORT}` )
    );
  } );



