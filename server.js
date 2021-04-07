'use strict';

require( 'dotenv' ).config();
const express = require( 'express' );
const server = express();
const cors = require( 'cors' );
const superAgent = require( 'superagent' );
const pg = require( 'pg' );

const client = new pg.Client( { connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
} );

const PORT = process.env.PORT || 5000;

server.use( cors() );
server.get( '/', homeHandler );
server.get( '/location', locationHandler );
server.get( '/weather', weatherHandler );
server.get( '/parks', parksHandler );
server.get( '/movies', moviesHandler );
server.get( '/yelp', yelpHandler );
server.get( '*', errorHandler );

function homeHandler( request, response ) {
  response.send( 'The server is working' );
}

function locationHandler( request, response ) {
  let city = request.query.city;
  let SQL = 'SELECT * FROM locations WHERE search_query = $1';
  let safeValues = [city];
  console.log( safeValues );
  client.query( SQL, safeValues )
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

function weatherHandler( request, response ) {
  let city = request.query.search_query;
  let key = process.env.WEATHER_KEY;
  // console.log( key );
  let weatherURL = `https://api.weatherbit.io/v2.0/forecast/daily?days=8&city=${city}&key=${key}`;
  superAgent.get( weatherURL )
    .then( weatherData => {
      let apiData = weatherData.body;
      let results = apiData.data.map( element => new Weather( element ) );
      response.send( results );
    } );

}
function parksHandler( request, response ) {
  let city = request.query.search_query;
  let key = process.env.PARK_KEY;
  let parkURL = `https://developer.nps.gov/api/v1/parks?q=${city}&api_key=${key}`;
  superAgent.get( parkURL )
    .then( parkData=>{
      let apiData = parkData.body;
      console.log( apiData );
      let results = apiData.data.map( element => new Park( element ) );
      response.send( results );
    } );
}

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

function yelpHandler( request, response ){
  let city = request.query.search_query;
  let page = request.query.page;
  let key = process.env.YELP_KEY;
  let numPerPage = 5;
  let start = ( ( page - 1 ) * numPerPage );
  let yelpURL = `https://api.yelp.com/v3/businesses/search?location=${city}&limit=${numPerPage}&offset=${start}`;
  superAgent.get( yelpURL )
    .set( 'Authorization', `Bearer ${key}` )
    .then( yelpData=>{
      let apiData = yelpData.body;
      console.log( apiData );
      let result = apiData.businesses.map( element=> new Yelp ( element ) );
      response.send( result );
    } );
}
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

client.connect()
  .then( () => {
    server.listen( PORT, () =>
      console.log( `listening on ${PORT}` )
    );
  } );



