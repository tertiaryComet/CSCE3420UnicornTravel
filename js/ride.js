/*global WildRydes _config*/

var WildRydes = window.WildRydes || {};
WildRydes.map = WildRydes.map || {};
let map;

(function rideScopeWrapper($) {
    var authToken;
    WildRydes.authToken.then(function setAuthToken(token) {
        if (token) {
            authToken = token;
        } else {
            window.location.href = '/signin.html';
        }
    }).catch(function handleTokenError(error) {
        alert(error);
        window.location.href = '/signin.html';
    });

    //  requestUnicorn
    //      make the POST request to the server
    function requestUnicorn(pickupLocation) {
        $.ajax({
            method: 'POST',
            url: _config.api.invokeUrl + '/ride',
            headers: {
                Authorization: authToken
            },
            data: JSON.stringify({
                PickupLocation: {
                    Latitude: pickupLocation.latitude,
                    Longitude: pickupLocation.longitude
                }
            }),
            contentType: 'application/json',
            success: result => completeRequest(result, pickupLocation),
            error: function ajaxError(jqXHR, textStatus, errorThrown) {
                console.error('Error requesting ride: ', textStatus, ', Details: ', errorThrown);
                console.error('Response: ', jqXHR.responseText);
                alert('An error occurred when requesting your unicorn:\n' + jqXHR.responseText);
            }
        });
    }

    //  completeRequest
    //      a Unicorn has been dispatched to your location
    function completeRequest(result, pickupLocation) {
        var unicorn;
        var pronoun;

        console.log('Response received from API: ', result);
        unicorn = result.Unicorn;
        pronoun = unicorn.Gender === 'Male' ? 'his' : 'her';
        displayUpdate(unicorn.Name + ', your ' + unicorn.Color + ' unicorn, is on ' + pronoun + ' way.', unicorn.Color);
        displayUpdate(' lat = ' + pickupLocation.latitude + ' long = ' + pickupLocation.longitude);
        console.log(pickupLocation);
        //  get the local weather, find nearby restaurants, movies
        //getWeather(pickupLocation, unicorn)
        getCurrentWeather(pickupLocation.latitude, pickupLocation.longitude);

        animateArrival(function animateCallback() {
            displayUpdate(unicorn.Name + ' has arrived. Giddy up!', unicorn.Color);
            WildRydes.map.unsetLocation();

            $('#request').prop('disabled', 'disabled');
            $('#request').text('Set Pickup');
        });
    }

    // Register click handler for #request button
    $(function onDocReady() {
        $('#request').click(handleRequestClick);

        WildRydes.authToken.then(function updateAuthMessage(token) {
            if (token) {
                displayUpdate('You are authenticated. Click to see your <a href="#authTokenModal" data-toggle="modal">auth token</a>.');
                $('.authToken').text(token);
            }
        });

        if (!_config.api.invokeUrl) {
            $('#noApiMessage').show();
        }

        window.navigator.geolocation
            .getCurrentPosition(setLocation);

        //  put the map behind the updates list
        document.getElementById("map").style.zIndex = "10";

        function setLocation(loc) {
            map = L.map('map').setView([loc.coords.latitude, loc.coords.longitude], 13);
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap'
            }).addTo(map);

            WildRydes.map.center = {latitude: loc.coords.latitude, longitude: loc.coords.longitude};
            let b = map.getBounds();        //  TODO moved
            WildRydes.map.extent = {minLat: b._northEast.lat, minLng: b._northEast.lng,
                maxLat: b._southWest.lat, maxLng: b._southWest.lng};

            WildRydes.marker  = L.marker([loc.coords.latitude, loc.coords.longitude]).addTo(map);
            var myIcon = L.icon({
                iconUrl: 'images/unicorn-icon.png',
                iconSize: [25, 25],
                iconAnchor: [22, 24],
                shadowSize: [25, 25],
                shadowAnchor: [22, 24]
            });
            WildRydes.unicorn = L.marker([loc.coords.latitude, loc.coords.longitude], {icon: myIcon}).addTo(map);
            // WildRydes.marker.bindPopup("<b>Hello world!</b><br>I am a popup.").openPopup();

            // var popup = L.popup();
            map.on('click', onMapClick);

            function onMapClick(e) {            //  TODO move to esri.js
                WildRydes.map.selectedPoint = {longitude: e.latlng.lng, latitude: e.latlng.lat};
                if (WildRydes.marker)       WildRydes.marker.remove();
                handlePickupChanged();

                WildRydes.marker  = L.marker([e.latlng.lat, e.latlng.lng]).addTo(map);

                // popup
                //     .setLatLng(e.latlng)
                //     .setContent("You clicked the map at " + e.latlng.toString())
                //     .openOn(map);
            }
        }
    });

    //  handlePickupChanged
    //      enable the Pickup button and set text to Request Unicorn
    function handlePickupChanged() {
        var requestButton = $('#request');
        requestButton.text('Request Unicorn');
        requestButton.prop('disabled', false);
    }

    //  handleRequestClick
    //      get current request location and POST request to server
    function handleRequestClick(event) {
        var pickupLocation =  WildRydes.map.selectedPoint;

        event.preventDefault();
        requestUnicorn(pickupLocation);
    }

    //  animateArrival
    //      animate the Unicorn's arrival to the user's pickup location
    function animateArrival(callback) {
        var dest = WildRydes.map.selectedPoint;
        var origin = {};

        if (dest.latitude > WildRydes.map.center.latitude) {
            origin.latitude = WildRydes.map.extent.minLat;
        } else {
            origin.latitude = WildRydes.map.extent.maxLat;
        }

        if (dest.longitude > WildRydes.map.center.longitude) {
            origin.longitude = WildRydes.map.extent.minLng;
        } else {
            origin.longitude = WildRydes.map.extent.maxLng;
        }

        WildRydes.map.animate(origin, dest, callback);
    }


}(jQuery));

//  these functions below here are my utility functions
//      to present messages to users
//      and to particularly add some 'sizzle' to the application

//  displayUpdate
//      nice utility method to show message to user
function displayUpdate(text, color='green') {
    $('#updates').prepend($(`<li style="background-color:${color}">${text}</li>`));
}


//I made this down here to see if the weather thing will work.
//the api key for openweathermap.org is 5396951f5842986a2bab0c0553efa4be
//Idk why it's async, I got this from chatGPT because I didn't know what to do.
//I'm sorry if using chatGPT is against the rules, I need very direct instructions. I'm not great at extrapolating data/unstated rules or what applies to rules.
async function getCurrentWeather(latitude, longitude) {
    const apiKey = '5396951f5842986a2bab0c0553efa4be';
    const apiUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}`;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        console.log(data); // Check the console to see the received weather data
        // Process and display the weather information
        const temperature = data.main.temp - 273.15; //Convert from kelvin to celsius.
        const feelsliketemp = data.main.feels_like - 273.15; //what the temperature feels like. Convert from Kelvin to Celsius.
        const describeweather = data.weather[0].description; //a description of the weather.

        displayUpdate('It is currently ' + temperature + ' degrees celsius at your destination, although it feels like ' + feelsliketemp + ' degrees celsius. The area can be described as having '+ describeweather+'.');
    } catch (error) {
        console.error('Error fetching weather data:', error);
    }
}