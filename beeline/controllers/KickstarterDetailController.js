import {NetworkError} from '../shared/errors';
import {formatDate, formatTime, formatUTCDate, formatHHMM_ampm} from '../shared/format';
import loadingTemplate from '../templates/loading.html';
import processingPaymentsTemplate from '../templates/processing-payments.html';
import assert from 'assert';
import busStopListTemplate from '../templates/bus-stop-list.html';

export default [
  '$rootScope','$scope','$interpolate','$state','$stateParams','$ionicModal',
  '$http','$cordovaGeolocation','BookingService','RoutesService','uiGmapGoogleMapApi',
  'MapOptions','loadingSpinner','UserService','StripeService','$ionicLoading','$ionicPopup',
  'KickstarterService',
  function(
    $rootScope,$scope,$interpolate,$state,$stateParams,$ionicModal,$http,
    $cordovaGeolocation,BookingService,RoutesService,uiGmapGoogleMapApi,
    MapOptions,loadingSpinner,UserService,StripeService,$ionicLoading,$ionicPopup,
    KickstarterService
  ) {
    // Gmap default settings
    $scope.map = MapOptions.defaultMapOptions();
    $scope.modalMap = MapOptions.defaultMapOptions();

    $scope.routePath = [];

    // Default settings for various info used in the page
    $scope.book = {
      routeId: null,
      route: null,
      bid: null,
      calculatedAmount: '',
      bidPrice: null,
    };
    $scope.disp = {
      popupStop: null,
      popupStopType: null,
      parentScope: $scope,
    }

    // Resolved when the map is initialized
    var gmapIsReady = new Promise((resolve, reject) => {
      var resolved = false;
      $scope.$watch('map.control.getGMap', function() {
        if ($scope.map.control.getGMap) {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }
      });
    });
    $scope.book.routeId = +$stateParams.routeId;

    $scope.$watch(()=>KickstarterService.getCrowdstartById($scope.book.routeId), (route)=>{
      if (!route) return;
      $scope.book.route = route;
      $scope.book.bidOptions = route.notes.tier;
      [$scope.book.boardStops, $scope.book.alightStops] = BookingService.computeStops($scope.book.route.trips);
      $scope.busStops = $scope.book.boardStops.concat($scope.book.alightStops);
    })



    $scope.$on('$ionicView.afterEnter', () => {
      loadingSpinner(gmapIsReady)
      .then(() => {
        var gmap = $scope.map.control.getGMap();
        MapOptions.resizePreserveCenter(gmap)
      });
    });

    gmapIsReady.then(function() {
      MapOptions.disableMapLinks();
    });

    $scope.$watchGroup(['busStops','map.control.getGMap'],([stops, gmap])=>{
      if (stops && gmap) {
        $scope.panToStops($scope.map.control.getGMap(), stops);
      }
    })

    $scope.$watch('book.route.path', (path) => {
      if (!path) {
        $scope.routePath = [];
      }
      else {
        RoutesService.decodeRoutePath(path)
        .then((decodedPath) => $scope.routePath = decodedPath)
        .catch(() => $scope.routePath = []);
      }
    })

    $scope.applyTapBoard = function (stop) {
      $scope.disp.popupStopType = "pickup";
      $scope.disp.popupStop = stop;
      $scope.$digest();
    }
    $scope.applyTapAlight = function (stop) {
      $scope.disp.popupStopType = "dropoff";
      $scope.disp.popupStop = stop;
      $scope.$digest();
    }

    $scope.closeWindow = function () {
      $scope.disp.popupStop = null;
    }

    $scope.modal = $ionicModal.fromTemplate(busStopListTemplate, {
      scope: $scope,
      animation: 'slide-in-up',
    })

    $scope.showStops = function(){
      $scope.modal.show();

      $scope.$watch('modalMap.control.getGMap', function(modalMap) {
        if (modalMap) {
          MapOptions.disableMapLinks();
          MapOptions.resizePreserveCenter($scope.modalMap.control.getGMap());
          //set modalMap bound
          $scope.panToStops($scope.modalMap.control.getGMap(), $scope.busStops);
        }
      });
    };
    $scope.close = function() {
      $scope.modal.hide();
    };
    // Cleanup the modal when we're done with it!
    $scope.$on('$destroy', function() {
      $scope.modal.remove();
    });

    /* Pans to the stops on the screen */
    $scope.panToStops = function(gmap, stops) {
      if (stops.length == 0) {
        return;
      }
      var bounds = new google.maps.LatLngBounds();
      for (let s of stops) {
        bounds.extend(new google.maps.LatLng(
          s.coordinates.coordinates[1],
          s.coordinates.coordinates[0]
        ));
      }
      gmap.fitBounds(bounds);
    };

    // pans to single stop
    $scope.panToStop = function(gmap, stop) {
      if (!stop) return;
      $scope.book.chosenStop = stop;
      gmap.panTo({
        lat: stop.coordinates.coordinates[1],
        lng: stop.coordinates.coordinates[0],
      })
      gmap.setZoom(17);
    }

    $scope.updateSelection = function(position, tiers, price) {
      _.forEach(tiers, function(tier, index){
        if (position == index) {
          $scope.book.bidPrice = $scope.book.bidPrice == price ? null : price;
        }
      })
    }
  }
];
//
