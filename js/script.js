// style components
nav_height = $(".navbar").height();

function styleSetup() {
	
	// make sure correct section is highlighted
	function selectSection(){
		var window_top = 1.5*$(window).scrollTop();
		var div_top = $('#intraUtility').offset().top - nav_height;
		if (window_top < div_top) {
			makeSelected('#aboutLink')
		} else {
			makeSelected('#intraULink')
		}
	}

	$(function() {
		$(window).scroll(selectSection);
		selectSection();
	});

	// dynamic padding and div sizing on window resize
	function dynamicPadding() {
		if ($(window).width() < 993){
			$(".noleftpadding")
			.removeClass("noleftpadding")
			.addClass("tempPadding")

		} else {
			$(".tempPadding")
			.removeClass("tempPadding")
			.addClass("noleftpadding")
		}
	}

	function dynamicSizing() {
		$("#extraUtility").css("min-height", `calc(100vh - ${nav_height}px)`);
		$("#map, #scenarioBuilder").css("height", `calc(100vh - ${nav_height}px)`);
		$("body").css("padding-top", nav_height)

	}

	dynamicPadding()
	dynamicSizing()

	$(window).resize(function(){
		nav_height = $(".navbar").height();
		dynamicSizing()
		dynamicPadding()
		tsSetup()
	});

	// turn popovers on, and open landscape area quality considerations
	// $(function () {
	// 	$('[data-toggle="popover"]').popover()
	// 	// $('#landscapeArea').popover({
	// 	// 	'placement':'bottom',
	// 	// 	'trigger': 'focus',
	// 	// 	'tabindex': "0"
	// 	// })
	// 	// .popover('show')
	// 	// .focus()
	// 	// $('.popover-content').scrollTop(730);
	// })
};

// function styleSetup() {
// 	$("body").css("padding-top", nav_height);
// 	$(".section, #map").css("height", `calc(100vh - ${nav_height}px)`);
// 	var ts_height = $("#map").height() - $("#filters").height() - $("#tsTitles").height() - 146; // the last term depends on the size of the elements above the chart
// 	$("#ts").css("height", ts_height);
// 	// $(window).resize(function(){location.reload()});
// };

function makeSelected(element) {
	$(".selected").removeClass("selected");
	$(element).attr("class","selected");
};

function smoothScroll(divId){
	$("html, body").animate({scrollTop:
		$(divId).offset().top - nav_height}, 1000)
};

function transition(element, content){
	$(element).fadeOut(function() {
		$(element).html(content);
		$(element).fadeIn();
	});
}

// visualization components
function generateQuery(where_clause, allDates=false) {
	var milliunix_start = new Date(state.startDate).getTime(),
	milliunix_end = new Date(state.endDate).getTime(),
		dayRange = (milliunix_end - milliunix_start)*1.1574*.00000001 + 30.437; // convert milliunix to days
		


		var tsQuery = `
		WITH cte_targets AS
		(SELECT
			*,
			${config.column_names.population} * ${state.gpcd} * 30.437 * 3.06889*10^(-6) + ${config.column_names.irrigable_area} * ${config.column_names.average_eto} * ${state.pf} * .62 * 3.06889*10^(-6) AS target_af,
			${config.column_names.population} * ${state.gpcd} * 30.437 + ${config.column_names.irrigable_area} * ${config.column_names.average_eto} * ${state.pf} * .62 AS target_gal,
			${config.column_names.population} * ${state.gpcd} * 30.437 + 1.1*${config.column_names.irrigable_area} * ${config.column_names.average_eto} * ${state.pf} * .62 AS u_gal,
			${config.column_names.population} * ${state.gpcd} * 30.437 + .9*${config.column_names.irrigable_area} * ${config.column_names.average_eto} * ${state.pf} * .62 AS l_gal
		FROM ${config.attribute_table}
			)
		SELECT
			*,
			ROUND(100 * (${config.column_names.usage}*${config.conversion_to_gal} * 3.06889*10^(-6) - target_af) / CAST(target_af AS FLOAT)) percentDifference,
			ROUND(${config.column_names.usage}*${config.conversion_to_gal} * 3.06889*10^(-6)) af_usage,
			${config.column_names.usage}*${config.conversion_to_gal} gal_usage
		FROM
			cte_targets
		${where_clause}
		ORDER BY
			${config.column_names.date}
		`

		var query = `
		WITH cte_record_cnt AS (
		SELECT
			COUNT(*) record_cnt, ${config.column_names.unique_id} unique_id,
			(DATE_PART('year', '${state.endDate}'::date) - DATE_PART('year', '${state.startDate}'::date)) * 12 +
			(DATE_PART('month', '${state.endDate}'::date) - DATE_PART('month', '${state.startDate}'::date) + 1) month_count
		FROM
			${config.attribute_table}
		${where_clause}
		GROUP BY
			${config.column_names.unique_id}

			),


		cte_otf AS
		(SELECT
			${config.geometry_table}.the_geom_webmercator,
			${config.geometry_table}.cartodb_id,
			${config.geometry_table}.${config.column_names.unique_id},
			${config.attribute_table}.${config.column_names.population},
			${config.attribute_table}.${config.column_names.irrigable_area},
			${config.attribute_table}.${config.column_names.average_eto},
			${config.attribute_table}.${config.column_names.usage},
			${config.attribute_table}.${config.column_names.date},
			${config.attribute_table}.${config.column_names.hr_name} hr_name
		FROM
			${config.geometry_table},
			${config.attribute_table}
		WHERE
			${config.geometry_table}.${config.column_names.unique_id} = ${config.attribute_table}.${config.column_names.unique_id}

			),
		cte_targets AS
		(SELECT     
			the_geom_webmercator,
			Min(cartodb_id) cartodb_id,
			Min(hr_name) hr_name,
			${config.column_names.unique_id},
			ROUND(AVG(${config.column_names.population})) population,
			SUM(${config.column_names.usage}*${config.conversion_to_gal}) * 3.06889*10^(-6) af_usage,
			SUM(${config.column_names.usage}*${config.conversion_to_gal}) gal_usage,
			AVG(${config.column_names.average_eto}) avg_eto,
			AVG(${config.column_names.irrigable_area}) irr_area,
			SUM(${config.column_names.population} * ${state.gpcd} * 30.437 * 3.06889*10^(-6) + ${config.column_names.irrigable_area} * ${config.column_names.average_eto} * ${state.pf} * .62 * 3.06889*10^(-6)) AS target_af,
			SUM(${config.column_names.population} * ${state.gpcd} * 30.437 + ${config.column_names.irrigable_area} * ${config.column_names.average_eto} * ${state.pf} * .62) AS target_gal
		FROM cte_otf
			${where_clause}

		GROUP BY
			${config.column_names.unique_id}, the_geom_webmercator)

		SELECT
			*,
			ROUND(100 * (gal_usage - target_gal) / CAST(target_gal AS FLOAT)) percentDifference,
			ROUND(CAST(af_usage AS NUMERIC), 2) - ROUND(CAST(target_af AS NUMERIC), 2) usageDifference,
			ROUND(CAST(target_af AS NUMERIC), 2) target_af_round,
			ROUND(CAST(af_usage AS NUMERIC), 2) af_usage_round

		FROM
			cte_targets

		ORDER BY
			percentDifference
		`

		// , cte_record_cnt
		// WHERE
		// 	cte_record_cnt.unique_id = cte_targets.${config.column_names.unique_id}
		// AND
		// 	record_cnt - month_count = 0

		if (allDates == true) {
			return tsQuery
		} else { 
			return query
		}
	};

	function tsSetup() {
		var markers = [	{[`${config.column_names.date}`]: new Date(state.startDate), "label": "START DATE"},
		{[`${config.column_names.date}`]: new Date(state.endDate), "label": "END DATE"}
		],
		query = generateQuery(where_clause=`WHERE ${config.column_names.unique_id} = ${state.placeID}`, allDates=true),
		encoded_query = encodeURIComponent(query),
		url = `https://${config.account}.carto.com/api/v2/sql?q=${encoded_query}`;
		$.getJSON(url, function(utilityData) {
			// currently this parser is being defined in multiple places
			// for dryness, we may want to define it only once elsewhere
			var parser = d3.time.format("%Y-%m-%dT%XZ"),
			mn = new Date(parser.parse(globals.dateData.rows[globals.dateData.total_rows - 1][config.column_names.date])),
			mx = new Date(parser.parse(globals.dateData.rows[0][config.column_names.date])),
			tsData = MG.convert.date(utilityData.rows, config.column_names.date, '%Y-%m-%dT%XZ'); // is this necessary?

		MG.data_graphic({
			data: tsData,
			full_width: true,
			// full_height: true,
			y_extended_ticks: true,
			x_extended_ticks: true,
			markers: markers,
			xax_format: d3.time.format('%b'),
			y_label: 'Water Volume (Gal)',
			min_x: mn,//utilityData.rows[0][config.column_names.date],
			max_x: mx,//utilityData.rows[utilityData.total_rows - 1][config.column_names.date],
			aggregate_rollover: true,
			show_confidence_band: ['l_gal', 'u_gal'],
			decimals: 0,
        	target: "#ts", // the html element that the graphic is inserted in
        	x_accessor: config.column_names.date,  // the key that accesses the x value
        	y_accessor: ['target_gal', 'gal_usage'], // the key that accesses the y value
        	legend:  ['Target', 'Usage'],
        	legend_target: "#tsLegend"
        });
		d3.selectAll('.label')
		.attr('transform', 'translate(-14, 0) rotate(-90)');
	});
};

function standardsSetup() {
	$("#pf")
	.val(state.pf)
	.keydown(function(e) {
		if(e.keyCode == 13) {
			state.pf = $(this).val()
			var query = generateQuery(where_clause=`WHERE ${config.column_names.date} BETWEEN '${state.startDate}' AND '${state.endDate}'`, allDates=false);
			globals.sublayers[0].setSQL(query);
			tsSetup();
		}
	});

	$("#gpcd")
	.val(state.gpcd)
	.keydown(function(e) {
		if(e.keyCode == 13) {
			state.gpcd = $(this).val()
			var query = generateQuery(where_clause=`WHERE ${config.column_names.date} BETWEEN '${state.startDate}' AND '${state.endDate}'`, allDates=false);
			globals.sublayers[0].setSQL(query);
			tsSetup();
		}
	});
};

function sliderSetup(datesTarget, tsTarget, legendTarget) {
	var formatter_short = d3.time.format("%b %Y"),
	formatter_long = d3.time.format("%Y-%m-%dT%XZ"),
	parser = d3.time.format("%Y-%m-%dT%XZ"),
	dates = $.map(globals.dateData.rows, function(el) {
		var tempDate = parser.parse(el[config.column_names.date]);
		return (tempDate.getTime())
	}).sort()

	var datesLength = dates.length - 1,
	startPosition = (
		dates.indexOf(
			parser.parse(state.startDate).getTime()
			)
		),
	endPosition = (
		dates.indexOf(
			parser.parse(state.endDate).getTime()
			)
		);


	$("#range_slider").slider({
		range: true,
		min: 0,
		max: datesLength - 1,  // exclude most recent month because data may not be available for all months
		step: 1,
		values: [startPosition, endPosition],
		stop: function (event, ui) {
			var startDate = dates[ui.values[0]],
			endDate = dates[ui.values[1]]
			
			state.startDate = `${formatter_long(new Date(startDate))}`
			state.endDate = `${formatter_long(new Date(endDate))}`
			query = generateQuery(where_clause=`WHERE ${config.column_names.date} BETWEEN '${state.startDate}' AND '${state.endDate}'`, allDates=false);
			globals.sublayers[0].setSQL(query);
			tsSetup();
		},
		slide: function(event, ui) {
			var startDate = dates[ui.values[0]],
			endDate = dates[ui.values[1]]
			
			state.startDate = `${formatter_long(new Date(startDate))}`
			state.endDate = `${formatter_long(new Date(endDate))}`
			tsSetup()
			var start = new Date(dates[ui.values[0]]),
			end = new Date(dates[ui.values[1]]);
			$("#cal").val(`${formatter_short(start)} - ${formatter_short(end)}`);
		}
	});
	var start = new Date(dates[$("#range_slider").slider("values", 0)]),
	end = new Date(dates[$("#range_slider").slider("values", 1)])
	$("#cal").val(`${formatter_short(start)} - ${formatter_short(end)}`);
}

function mapSetup_dm() {
	var map = new L.Map("map", {
		center: config.coordinates,
		zoom: config.zoom,
		scrollWheelZoom:false
	});
	function searchSetup() {
	//reference: http://bl.ocks.org/javisantana/7932459
	var sql = cartodb.SQL({ user: config.account });
	$( "#hrName" )
	.autocomplete({
		source: function( request, response ) {
			var s
			sql.execute(
				`
				SELECT DISTINCT ${config.column_names.hr_name}
				FROM ${config.attribute_table}
				WHERE ${config.column_names.hr_name}::text ilike '%${request.term}%'`
				).done(function(data) {
					response(data.rows.map(function(r) {
						return {
							label: r[config.column_names.hr_name],
							value: r[config.column_names.hr_name]
						}
					})
					)
				})
			},
			minLength: 4,
			select: function( event, ui ) {
				state.hrName = ui.item.value;
				query = generateQuery(where_clause=`WHERE ${config.column_names.hr_name} = '${state.hrName}' AND ${config.column_names.date} BETWEEN '${state.startDate}' AND '${state.endDate}'`, queryType=false);
				sql.execute(query).done(function(data){

					showFeature(data.rows[0].cartodb_id)
					state.placeID = data.rows[0][config.column_names.unique_id];
					var target_af = data.rows[0].target_af_round,
					usagedifference = data.rows[0].usagedifference,
					percentdifference = data.rows[0].percentdifference,
					hrName = data.rows[0].hr_name;
					usage = data.rows[0].af_usage_round,
					// uncertainty = data.rows[0].uncertainty,

					// latLng = new L.LatLng(data.rows[0].lat, data.rows[0].lon);
					// map.panTo(latLng);

					summarySentence_dm(usagedifference, percentdifference, target_af, hrName, usage, place_change = true);
					tsSetup()

					console.log(`irrigated area: ${data.rows[0].irr_area}`)
					console.log(`average eto: ${data.rows[0].avg_eto}`)

				})

			}
		});
};

// Highlight feature setup below based on: http://bl.ocks.org/javisantana/d20063afd2c96a733002
var sql = new cartodb.SQL( {
	user: config.account,
	format: 'geojson' });
var polygon;

function showFeature(cartodb_id) {

	sql.execute(`select ST_Centroid(the_geom) as the_geom from ${config.geometry_table} where cartodb_id = {{cartodb_id}}`, {cartodb_id: cartodb_id} )
	.done(function(geojson) {
		if (polygon) {
			
			map.removeLayer(polygon);

		}
		polygon = L.geoJson(geojson, { 
			style: {}
		}).addTo(map);
	});
}
// End highlight feature setup

var placeLayer = {
	user_name: config.account,
	type: 'cartodb',
	sublayers: [{
		sql: generateQuery(where_clause=`WHERE ${config.column_names.date} BETWEEN '${state.startDate}' AND '${state.endDate}'`, allDates=false),
		cartocss: cartography.cartocss,
		interactivity: ['cartodb_id', 'irr_area', 'avg_eto', 'usagedifference', 'percentdifference', 'target_af_round', 'target_af', 'population', 'gal_usage', 'af_usage', 'af_usage_round', 'target_gal', 'hr_name', `${config.column_names.unique_id}`]
	}]
};

    // Pull tiles from OpenStreetMap
    L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
    	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
    }).addTo(map);

    $("#map").append(cartography.legend.render().el);


    cartodb.createLayer(map, placeLayer, options = {
    	https: true
    })
    .addTo(map, 0)
    .done(function(layer) {
    	for (var i = 0; i < layer.getSubLayerCount(); i++) {
    		globals.sublayers[i] = layer.getSubLayer(i);
    	};

    	globals.sublayers[0].setInteraction(true);
    	layer.leafletMap.viz.addOverlay({
    		type: 'tooltip',
    		layer: globals.sublayers[0],
    		template: cartography.tooltip,
    		position: 'top|right',
    		fields: [{ population:'population'}] // Unclear how this option operates
    	});

    	layer.on('loading', function() {
    		query = generateQuery(where_clause=`WHERE ${config.column_names.date} BETWEEN '${state.startDate}' AND '${state.endDate}'`, allDates=false);
    		encoded_query = encodeURIComponent(query);
    		 url = `https://${config.account}.carto.com/api/v2/sql?q=${encoded_query}`;
    		 $.getJSON(url, function(utilityData) {
    		 	for (row in utilityData.rows) {
    		 		if (utilityData.rows[row][config.column_names.unique_id] == state.placeID) {
    		 			var target_af = utilityData.rows[row].target_af_round,
    		 			usagedifference = utilityData.rows[row].usagedifference,
    		 			percentdifference = utilityData.rows[row].percentdifference,
    		 			hrName = utilityData.rows[row].hr_name,
    		 			usage = utilityData.rows[row].af_usage_round;
    		 			summarySentence_dm(usagedifference, percentdifference, target_af, hrName, usage);
    		 			showFeature(utilityData.rows[row].cartodb_id);
    		 		};
    		 	};
    		 });
    		});

    	
    	globals.sublayers[0].on('featureOver', function(e, latlng, pos, data) {
    		$("#map").css('cursor', 'pointer')
    	});

    	globals.sublayers[0].on('featureOut', function(e, latlng, pos, data) {
    		$("#map").css('cursor','')
    	});

    	globals.sublayers[0].on('featureClick', function(e, latlng, pos, data) {
    		showFeature(data.cartodb_id)
    		state.placeID = data[config.column_names.unique_id];
    		var target_af = data.target_af_round,
    		usagedifference = data.usagedifference,
    		percentdifference = data.percentdifference,
    		hrName = data.hr_name,
    		usage = data.af_usage_round;
    		summarySentence_dm(usagedifference, percentdifference, target_af, hrName, usage, place_change = true);
    		tsSetup(data.af_usage)
    		console.log(`irrigated area: ${data.irr_area}`)
    		console.log(`average eto: ${data.avg_eto}`)
    		
    	});
    	searchSetup()
    });
};

function summarySentence_dm(usageDifference, percentDifference, targetValue, hrName, usage, place_change = false){
	if (usageDifference < 0) {
		var differenceDescription = 'under'
	} else {
		var differenceDescription = 'over'
	}
	// var summary = `
	// <b>Place:</b> ${hrName}<br>
	// <b>Residential Usage Target:</b> ${targetValue} acre-feet<br>
	// <b>Efficiency:</b> ${Math.abs(usageDifference)} acre-feet <em>${differenceDescription}</em> target in this scenario | ${percentDifference}%
	// `
	transition("#targetValue", targetValue + " AF")
	transition("#usage", usage + " AF")
	transition("#efficiency", `${Math.abs(usageDifference)} AF <em>${differenceDescription}</em> target in this scenario | ${percentDifference}%`)
	if (place_change == true){
		$("#hrName").val(hrName)
		//transition("#hrName", hrName)
	}
	// transition("#summarySentence", summary)
};


// app build
function main(){

	// style setup
	styleSetup()	
	smoothScroll('#extraUtility') // prescribe starting div

	// visualization setup
	sliderSetup();
	standardsSetup();
	tsSetup();
	mapSetup_dm();
}