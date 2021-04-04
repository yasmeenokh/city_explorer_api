'use strict';

require( 'dotenv' ).config();
const express = require( 'express' );
const server = express();
const cors = require( 'cors' );


const PORT = process.env.PORT || 5000;


server.use( cors() );

server.get( '/',( request, response )=>{
  response.send( 'The server is working' );
} );

server.get( '/location', ( request, response )=>{
  let geoData = require ( './data/location.json' );
  let locationData = new location ( geoData );
  response.send( locationData );
} );

function location ( data ){
  this.search_query = 'Lynwood';
  this.latitude = data[0].lat;
  this.longitude = data[0].lon;
  this.formatted_query = data[0].display_name;
}

server.get( '/weather', ( request, response )=>{
  let weatherInfo = require ( './data/weather.json' );
  let results = [];
  weatherInfo.data.forEach( element => results.push( new Weather( element ) ) );
  // ( new Weather( element ) );
  response.send( results );
} );

function Weather ( data ){
  this.forecast = data.weather.description;
  this.time = data.datetime;
}

server.get( '*',( request,response )=>{
  let errorObj = {
    status: 500,
    responseText: 'Sorry, something went wrong'
  };
  response.status( 500 ).send( errorObj );
} );
server.listen( PORT, ()=>{
  console.log( `listening on port ${PORT}` );
} );


