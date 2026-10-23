import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../core/supabase_client.dart';
import '../core/theme.dart';

class OwnerAttendanceScreen extends StatefulWidget {
  const OwnerAttendanceScreen({super.key});

  @override
  State<OwnerAttendanceScreen> createState() => _OwnerAttendanceScreenState();
}

class _OwnerAttendanceScreenState extends State<OwnerAttendanceScreen> {
  String? _checkIn;
  String? _checkOut;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final response = await AppSupabase.client.functions.invoke('attendance-qr');
    final data = response.data as Map;
    setState(() {
      _checkIn = data['checkIn'] as String?;
      _checkOut = data['checkOut'] as String?;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Today\'s QR codes'), backgroundColor: AppColors.background, elevation: 0),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(24),
              child: Row(
                children: [
                  Expanded(child: _qrCard('Check-In', _checkIn!)),
                  const SizedBox(width: 16),
                  Expanded(child: _qrCard('Check-Out', _checkOut!)),
                ],
              ),
            ),
    );
  }

  Widget _qrCard(String label, String data) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(22)),
      child: Column(
        children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          QrImageView(data: data, size: 140),
        ],
      ),
    );
  }
}
