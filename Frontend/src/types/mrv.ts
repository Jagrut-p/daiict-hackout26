export interface MrvCertificateProps {
  /** Unique identifier for the completed processing batch */
  batchId: string;
  /** Total avoided landfill methane in tCO2e */
  totalMethaneAvoided: number;
  /** Total transport emissions evaluated across multi-stop routes in tCO2e */
  transportEmissions: number;
  /** Net climate benefit / offset (Avoided - Transport - Processing) in tCO2e */
  netCarbonOffset: number;
  /** Version identifier of the calculation engine methodology (e.g. '2.4.1', '1.0.0-AR6') */
  calculationVersion?: string | null;

  // Optional extended audit metadata for rich compliance presentation
  facilityName?: string;
  wasteTonnageDiverted?: number;
  wasteType?: string;
  processingMethod?: string;
  dataQualityTier?: 'Tier A' | 'Tier B' | 'Tier C' | 'Tier D';
  issuedAt?: string;
  auditHash?: string;
  generatorIds?: string[];
}
