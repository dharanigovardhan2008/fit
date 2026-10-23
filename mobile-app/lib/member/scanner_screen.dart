import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../core/supabase_client.dart';
import '../core/theme.dart';

/// Member check-in/out scanner. QR plus GPS is the primary attendance method;
/// geofence auto check-out is a separate, clearly explained optional feature.
class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  String? _message;
  bool _busy = false;

  Future<void> _handleCode(String token) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      final permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        await Geolocator.requestPermission();
      }
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
      final response = await AppSupabase.client.functions.invoke('attendance-scan', body: {
        'token': token,
        'latitude': position.latitude,
        'longitude': position.longitude,
        'accuracy': position.accuracy,
      });
      setState(() => _message = (response.data as Map)['message']?.toString() ?? 'Done');
    } catch (_) {
      setState(() => _message = 'We could not record your attendance. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Check in / Check out'), backgroundColor: AppColors.background, elevation: 0),
      body: Column(
        children: [
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: MobileScanner(onDetect: (capture) {
                final barcode = capture.barcodes.first;
                final raw = barcode.rawValue;
                if (raw != null) _handleCode(raw);
              }),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              _message ?? 'Point the camera at the gym check-in or check-out QR code.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: AppColors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}
