import 'dart:async';

import 'package:geolocator/geolocator.dart';

import '../core/supabase_client.dart';

/// Optional, Android-only auto check-out: if a checked-in member stays outside the gym
/// radius for 10 continuous minutes, the session is closed with method geofence.
/// This is a convenience on top of the primary QR + GPS flow, never a replacement for it.
/// Show GeofencePermissionScreen before enabling, explaining why background location is used.
class GeofenceService {
  GeofenceService._();
  static final instance = GeofenceService._();

  Timer? _outsideTimer;
  StreamSubscription<Position>? _subscription;

  void start({required double gymLat, required double gymLng, required int radiusM}) {
    _subscription = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 25),
    ).listen((position) {
      final distance = Geolocator.distanceBetween(gymLat, gymLng, position.latitude, position.longitude);
      if (distance > radiusM) {
        _outsideTimer ??= Timer(const Duration(minutes: 10), _autoCheckOut);
      } else {
        _outsideTimer?.cancel();
        _outsideTimer = null;
      }
    });
  }

  Future<void> _autoCheckOut() async {
    await AppSupabase.client.functions.invoke('attendance-scan', body: {
      'method': 'geofence',
    });
    _outsideTimer = null;
  }

  void stop() {
    _subscription?.cancel();
    _outsideTimer?.cancel();
  }
}
