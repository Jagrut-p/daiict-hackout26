import React, { useState, useMemo, useId } from 'react';
import {
  Search,
  Copy,
  Check,
  FileSpreadsheet,
  ArrowRight,
  RotateCcw,
  Plus,
  Layers,
  Leaf,
  Clock,
  Building2,
  Trash2,
  ShieldCheck,
} from 'lucide-react';

export type LedgerShipmentStatus = 'Queued' | 'Dispatched' | 'Verified';

export interface LedgerTransaction {
  id: string; // Full RFC4122 UUID
  timestamp: string;
  generatorName: string;
  facilityName: string;
  status: LedgerShipmentStatus;
  netCarbonImpact: number; // Net tCO2e offset benefit (Avoided - Transport)
  wasteType?: string;
  weightTons?: number;
}

// Seed dataset representing verified, dispatched, and queued industrial manifests
export const INITIAL_LEDGER_DATA: LedgerTransaction[] = [
  {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    timestamp: '2026-09-12T11:32:00Z',
    generatorName: 'Apex Petrochemical Refining Ltd.',
    facilityName: 'Sector 30 EcoSync HazMat Plant',
    status: 'Verified',
    netCarbonImpact: 6.84,
    wasteType: 'Hazardous',
    weightTons: 12.5,
  },
  {
    id: '8a3b129c-7e44-4f01-b8d2-3c5e89a10123',
    timestamp: '2026-09-12T11:05:00Z',
    generatorName: 'Gujarat APMC Terminal Yard',
    facilityName: 'Gandhinagar Anaerobic Bio-Digester',
    status: 'Dispatched',
    netCarbonImpact: 4.12,
    wasteType: 'Organic',
    weightTons: 8.2,
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174000',
    timestamp: '2026-09-12T10:48:00Z',
    generatorName: 'Indo-Steel Metal Fabricators & Recyclers',
    facilityName: 'EcoSync Resource Recovery Center',
    status: 'Verified',
    netCarbonImpact: 8.95,
    wasteType: 'Recyclable',
    weightTons: 15.0,
  },
  {
    id: '9d72e61a-0f33-4a81-93bb-6b81cf712841',
    timestamp: '2026-09-12T10:15:00Z',
    generatorName: 'Solvent Synthesis Tech Parks',
    facilityName: 'EcoSync Central Treatment Station',
    status: 'Queued',
    netCarbonImpact: 2.38,
    wasteType: 'Industrial',
    weightTons: 6.4,
  },
  {
    id: 'b1e8432a-d99f-4328-98e2-aa1459203bc8',
    timestamp: '2026-09-12T09:40:00Z',
    generatorName: 'Sanand Automotive Stamping Hub',
    facilityName: 'Sector 30 EcoSync HazMat Plant',
    status: 'Dispatched',
    netCarbonImpact: 3.75,
    wasteType: 'Industrial',
    weightTons: 9.1,
  },
  {
    id: 'c83d917f-4421-4f77-8ea0-5591bf612999',
    timestamp: '2026-09-12T09:12:00Z',
    generatorName: 'Ahmedabad Municipal Bio-Station #4',
    facilityName: 'Gandhinagar Anaerobic Bio-Digester',
    status: 'Verified',
    netCarbonImpact: 7.21,
    wasteType: 'Organic',
    weightTons: 14.8,
  },
  {
    id: 'e209841f-117c-4822-b911-7c98031d4e22',
    timestamp: '2026-09-12T08:30:00Z',
    generatorName: 'Vatva Chemical Synthesis Complex',
    facilityName: 'EcoSync Resource Recovery Center',
    status: 'Queued',
    netCarbonImpact: 1.95,
    wasteType: 'Hazardous',
    weightTons: 4.5,
  },
];

export interface ShipmentAuditLedgerProps {
  initialTransactions?: LedgerTransaction[];
  onSelectShipment?: (shipmentId: string) => void;
}

export const ShipmentAuditLedger: React.FC<ShipmentAuditLedgerProps> = ({
  initialTransactions = INITIAL_LEDGER_DATA,
  onSelectShipment,
}) => {
  const searchInputId = useId();
  const [transactions, setTransactions] = useState<LedgerTransaction[]>(initialTransactions);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'All' | LedgerShipmentStatus>('All');

  // Copy full UUID to clipboard with visual check feedback
  const handleCopyUUID = (fullId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(fullId);
    }
    setCopiedId(fullId);
    setTimeout(() => {
      setCopiedId((current) => (current === fullId ? null : current));
    }, 2000);
  };

  // TEST CASE 1: Filter table rows by Shipment UUID (case-insensitive search)
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Matches full or truncated UUID query
      const matchesSearch =
        !searchQuery.trim() ||
        tx.id.toLowerCase().includes(searchQuery.trim().toLowerCase());

      // Optional status filter
      const matchesStatus =
        statusFilter === 'All' || tx.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [transactions, searchQuery, statusFilter]);

  // Truncate UUID to format e.g. "123e..." or "123e4567..."
  const truncateUUID = (uuid: string): string => {
    if (!uuid) return '';
    if (uuid.length <= 12) return uuid;
    return `${uuid.substring(0, 8)}...`;
  };

  // Helper to format ISO timestamps nicely
  const formatTimestamp = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  // Helper to render required status badges
  // Verified: Green badge
  // Dispatched: Yellow badge
  // Queued: Gray badge
  const renderStatusBadge = (status: LedgerShipmentStatus) => {
    switch (status) {
      case 'Verified':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Verified
          </span>
        );
      case 'Dispatched':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Dispatched
          </span>
        );
      case 'Queued':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-700/50 text-slate-300 border border-slate-600/50">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Queued
          </span>
        );
    }
  };

  // Add new random transaction for demo
  const handleAddNewRecord = () => {
    const randomId = crypto.randomUUID();
    const statuses: LedgerShipmentStatus[] = ['Verified', 'Dispatched', 'Queued'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    const wasteTypes = ['Hazardous', 'Organic', 'Recyclable', 'Industrial'];
    const randomWaste = wasteTypes[Math.floor(Math.random() * wasteTypes.length)];

    const newTx: LedgerTransaction = {
      id: randomId,
      timestamp: new Date().toISOString(),
      generatorName: `Industrial Cluster Unit #${Math.floor(10 + Math.random() * 90)}`,
      facilityName: 'EcoSync Resource Recovery Center',
      status: randomStatus,
      netCarbonImpact: parseFloat((2 + Math.random() * 8).toFixed(2)),
      wasteType: randomWaste,
      weightTons: parseFloat((5 + Math.random() * 15).toFixed(1)),
    };

    setTransactions((prev) => [newTx, ...prev]);
  };

  // Reset to initial dataset
  const handleResetData = () => {
    setTransactions(INITIAL_LEDGER_DATA);
    setSearchQuery('');
    setStatusFilter('All');
  };

  // Clear all for testing Test Case 2 empty state
  const handleClearAll = () => {
    setTransactions([]);
  };

  return (
    <div className="w-full space-y-4">
      {/* Header & Controls Strip */}
      <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-5 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-md">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Shipment Audit Ledger
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  {filteredTransactions.length} of {transactions.length} Records
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Complete historical audit trail of manifest dispatches, routes, and verified carbon offsets.
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAddNewRecord}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/10"
              title="Add a new mock shipment record"
            >
              <Plus size={14} />
              <span>Add Record</span>
            </button>

            <button
              type="button"
              onClick={handleResetData}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5"
              title="Reset sample records"
            >
              <RotateCcw size={13} />
              <span>Reset Data</span>
            </button>

            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-800/60 text-slate-400 text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5"
              title="Test Case 2: Clear all rows to test empty state"
            >
              <Trash2 size={13} />
              <span>Clear Table (Test Empty State)</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar: TEST CASE 1 Search Bar & Status Tabs */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* TEST CASE 1: Search Bar for Shipment UUID */}
          <div className="relative flex-1 max-w-md">
            <label htmlFor={searchInputId} className="sr-only">
              Search by Shipment UUID
            </label>
            <input
              id={searchInputId}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Shipment UUID (e.g. 123e or f47ac)..."
              className="w-full bg-slate-950/90 border border-slate-700 rounded-xl px-4 py-2 pl-9 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
            />
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800"
              >
                Clear
              </button>
            )}
          </div>

          {/* Status Filter Chips */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
            {(['All', 'Verified', 'Dispatched', 'Queued'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  statusFilter === status
                    ? 'bg-slate-800 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Ledger Table Card */}
      <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4">
                  <span className="flex items-center gap-1.5">
                    <Clock size={13} className="text-slate-500" />
                    Timestamp
                  </span>
                </th>
                <th className="py-3.5 px-4">
                  <span className="flex items-center gap-1.5">
                    <Layers size={13} className="text-slate-500" />
                    Shipment UUID
                  </span>
                </th>
                <th className="py-3.5 px-4">
                  <span className="flex items-center gap-1.5">
                    <Building2 size={13} className="text-slate-500" />
                    Route (Generator → Facility)
                  </span>
                </th>
                <th className="py-3.5 px-4">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-slate-500" />
                    Status
                  </span>
                </th>
                <th className="py-3.5 px-4 text-right">
                  <span className="inline-flex items-center gap-1.5 justify-end">
                    <Leaf size={13} className="text-emerald-400" />
                    Net Carbon Impact
                  </span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => {
                  const isCopied = copiedId === tx.id;

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => onSelectShipment && onSelectShipment(tx.id)}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        onSelectShipment ? 'cursor-pointer' : ''
                      }`}
                    >
                      {/* Column 1: Timestamp */}
                      <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                        {formatTimestamp(tx.timestamp)}
                      </td>

                      {/* Column 2: Shipment UUID (truncated with copy button) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="font-mono text-cyan-400 font-semibold bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-900/60"
                            title={tx.id}
                          >
                            {truncateUUID(tx.id)}
                          </span>

                          {/* Copy Icon Button with visual feedback */}
                          <button
                            type="button"
                            onClick={(e) => handleCopyUUID(tx.id, e)}
                            className={`p-1 rounded-lg border transition-all ${
                              isCopied
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm'
                                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border-slate-700'
                            }`}
                            title={isCopied ? 'Copied full UUID!' : 'Copy full UUID to clipboard'}
                          >
                            {isCopied ? <Check size={13} /> : <Copy size={13} />}
                          </button>

                          {isCopied && (
                            <span className="text-[10px] text-emerald-400 font-mono animate-fade-in">
                              Copied!
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Column 3: Route (Generator -> Facility) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-200">
                            {tx.generatorName}
                          </span>
                          <ArrowRight size={12} className="text-slate-500 shrink-0 mx-0.5" />
                          <span className="text-slate-400">
                            {tx.facilityName}
                          </span>
                        </div>
                        {tx.wasteType && tx.weightTons && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-2">
                            <span>{tx.wasteType}</span>
                            <span>•</span>
                            <span>{tx.weightTons} Tons</span>
                          </div>
                        )}
                      </td>

                      {/* Column 4: Status (Verified = Green, Dispatched = Yellow, Queued = Gray) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderStatusBadge(tx.status)}
                      </td>

                      {/* Column 5: Net Carbon Impact */}
                      <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap">
                        <span
                          className={`font-bold ${
                            tx.netCarbonImpact > 0
                              ? 'text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-800/40 inline-block'
                              : 'text-slate-400 bg-slate-800/40 px-2.5 py-1 rounded-lg border border-slate-700/40 inline-block'
                          }`}
                        >
                          {tx.netCarbonImpact > 0 ? `+${tx.netCarbonImpact.toFixed(2)}` : tx.netCarbonImpact.toFixed(2)} tCO₂e
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                /* TEST CASE 2: Placeholder Empty State */
                <tr>
                  <td colSpan={5} className="py-12 px-4 text-center">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-500">
                        <FileSpreadsheet size={24} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-300">
                          No shipments recorded yet
                        </h4>
                        <p className="text-xs text-slate-500">
                          {searchQuery
                            ? `No records found matching UUID "${searchQuery}". Try clearing the search filter.`
                            : 'There are currently no historical waste transactions registered in the ledger.'}
                        </p>
                      </div>
                      <div className="pt-2 flex items-center justify-center gap-2">
                        {searchQuery ? (
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="px-3 py-1.5 rounded-xl bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 transition-all"
                          >
                            Clear Search Filter
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleResetData}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 transition-all"
                          >
                            Load Sample Ledger Data
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Ledger Footer Summary */}
        {filteredTransactions.length > 0 && (
          <div className="p-3.5 bg-slate-950/60 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <span>Showing {filteredTransactions.length} transactions</span>
              <span>•</span>
              <span className="font-mono text-emerald-400">
                Total Offset Benefit:{' '}
                {filteredTransactions
                  .reduce((acc, curr) => acc + curr.netCarbonImpact, 0)
                  .toFixed(2)}{' '}
                tCO₂e
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Verified ({filteredTransactions.filter((t) => t.status === 'Verified').length})
              </span>
              <span className="flex items-center gap-1 ml-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Dispatched ({filteredTransactions.filter((t) => t.status === 'Dispatched').length})
              </span>
              <span className="flex items-center gap-1 ml-2">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                Queued ({filteredTransactions.filter((t) => t.status === 'Queued').length})
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
