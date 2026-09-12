import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FacilityIntakeTerminal from './FacilityIntakeTerminal';
import { Shipment, VerificationPayload, VerificationResponse } from '../types/intake';

const mockShipment: Shipment = {
  shipmentUuid: 'SHIP-9000',
  generatorName: 'Apex Green Foods Ltd',
  declaredWasteType: 'Organic Commercial Waste',
  expectedWeightTons: 10.0,
  status: 'ARRIVED',
  sourceLotId: 'LOT-9000',
  wasteTypeId: 'wt_food'
};

describe('FacilityIntakeTerminal Component', () => {
  let mockFetchShipment: (uuid: string) => Promise<Shipment | null>;
  let mockOnVerify: (payload: VerificationPayload) => Promise<VerificationResponse>;

  beforeEach(() => {
    mockFetchShipment = vi.fn().mockResolvedValue(mockShipment);
    mockOnVerify = vi.fn().mockImplementation(async (payload: VerificationPayload) => ({
      success: true,
      message: 'Verified successfully',
      verificationId: 'VRF-123456',
      shipmentUuid: payload.shipmentUuid,
      status: payload.requiresManualAudit ? 'AUDIT_REQUIRED' : 'VERIFIED',
      actualWeightTons: payload.actualWeightTons,
      expectedWeightTons: payload.expectedWeightTons,
      deviationPercentage: payload.deviationPercentage,
      requiresManualAudit: payload.requiresManualAudit,
      proofHash: '0xabc123',
      verifiedAt: payload.verifiedAt
    }));
  });

  it('renders shipment card with Expected Weight, Declared Waste Type, and Generator Name', async () => {
    render(
      <FacilityIntakeTerminal
        initialShipmentUuid="SHIP-9000"
        onFetchShipment={mockFetchShipment}
        onVerify={mockOnVerify}
      />
    );

    // Wait for shipment manifest card to load
    await waitFor(() => {
      expect(screen.getByTestId('shipment-manifest-card')).toBeInTheDocument();
    });

    // Verify Generator Name is displayed
    expect(screen.getByTestId('display-generator-name')).toHaveTextContent('Apex Green Foods Ltd');

    // Verify Declared Waste Type is displayed
    expect(screen.getByTestId('display-waste-type')).toHaveTextContent('Organic Commercial Waste');

    // Verify Expected Weight is displayed
    expect(screen.getByTestId('display-expected-weight')).toHaveTextContent('10.00');
  });

  // TEST CASE 2: The "Verify" button is disabled until a valid weight is entered
  it('Test Case 2: The "Verify & Finalize Record" button is disabled until a valid weight is entered', async () => {
    render(
      <FacilityIntakeTerminal
        initialShipmentUuid="SHIP-9000"
        onFetchShipment={mockFetchShipment}
        onVerify={mockOnVerify}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('shipment-manifest-card')).toBeInTheDocument();
    });

    const verifyBtn = screen.getByTestId('verify-record-button');
    const weightInput = screen.getByTestId('actual-weight-input');

    // 1. Initial state (empty weight input) -> button must be disabled
    expect(weightInput).toHaveValue(null);
    expect(verifyBtn).toBeDisabled();

    // 2. Invalid weight (0 or negative) -> button must remain disabled
    fireEvent.change(weightInput, { target: { value: '0' } });
    expect(verifyBtn).toBeDisabled();

    fireEvent.change(weightInput, { target: { value: '-5' } });
    expect(verifyBtn).toBeDisabled();

    // 3. Valid positive weight entered -> button must be enabled
    fireEvent.change(weightInput, { target: { value: '10.0' } });
    expect(verifyBtn).not.toBeDisabled();
  });

  // TEST CASE 1: If actual weight deviates by more than 10%, display prominent yellow warning banner
  it('Test Case 1: Displays prominent yellow warning banner when actual weight deviates by >10%', async () => {
    render(
      <FacilityIntakeTerminal
        initialShipmentUuid="SHIP-9000"
        onFetchShipment={mockFetchShipment}
        onVerify={mockOnVerify}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('shipment-manifest-card')).toBeInTheDocument();
    });

    const weightInput = screen.getByTestId('actual-weight-input');

    // Enter weight with 5% deviation (10.5 tons vs 10.0 expected -> 5.0% <= 10%)
    fireEvent.change(weightInput, { target: { value: '10.5' } });
    expect(screen.queryByTestId('weight-discrepancy-warning')).not.toBeInTheDocument();
    expect(screen.getByTestId('tolerance-ok-banner')).toBeInTheDocument();

    // Enter overweight with 20% deviation (12.0 tons vs 10.0 expected -> 20% > 10%)
    fireEvent.change(weightInput, { target: { value: '12.0' } });

    const warningBanner = screen.getByTestId('weight-discrepancy-warning');
    expect(warningBanner).toBeInTheDocument();
    expect(warningBanner).toHaveTextContent(/Weight Discrepancy Detected - Requires Manual Audit/i);

    // Enter underweight with 15% deviation (8.5 tons vs 10.0 expected -> 15% > 10%)
    fireEvent.change(weightInput, { target: { value: '8.5' } });
    const underweightWarning = screen.getByTestId('weight-discrepancy-warning');
    expect(underweightWarning).toBeInTheDocument();
    expect(underweightWarning).toHaveTextContent(/Weight Discrepancy Detected - Requires Manual Audit/i);
  });

  it('triggers verification API call with payload and updates status on click', async () => {
    render(
      <FacilityIntakeTerminal
        initialShipmentUuid="SHIP-9000"
        onFetchShipment={mockFetchShipment}
        onVerify={mockOnVerify}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('shipment-manifest-card')).toBeInTheDocument();
    });

    const weightInput = screen.getByTestId('actual-weight-input');
    const verifyBtn = screen.getByTestId('verify-record-button');

    fireEvent.change(weightInput, { target: { value: '9.8' } });
    expect(verifyBtn).not.toBeDisabled();

    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(mockOnVerify).toHaveBeenCalledTimes(1);
    });

    expect(mockOnVerify).toHaveBeenCalledWith(
      expect.objectContaining({
        shipmentUuid: 'SHIP-9000',
        expectedWeightTons: 10.0,
        actualWeightTons: 9.8,
        deviationPercentage: 2.0,
        requiresManualAudit: false
      })
    );

    // Shows verification certificate card
    await waitFor(() => {
      expect(screen.getByTestId('verification-success-card')).toBeInTheDocument();
    });
  });
});
