import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../api';
import AddMemberModal from './AddMemberModal';
import './NewSubscription.css';
import { format } from 'date-fns';

const NewSubscription = () => {
    const [step, setStep] = useState(1);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Initial Data
    const [packages, setPackages] = useState([]);
    const [sports, setSports] = useState([]);
    const [courts, setCourts] = useState([]);
    const [activeTeams, setActiveTeams] = useState([]);

    // --- Onboarding Flow Mode ---
    // 'new_team': User creates a new team reservation and adds members
    // 'existing_team': User selects an existing team with capacity and adds a member
    const [onboardingMode, setOnboardingMode] = useState('new_team'); 
    
    // --- Existing Team Selection State ---
    const [selectedTeamId, setSelectedTeamId] = useState('');

    // --- Form data state (New Team) ---
    const [selectedSport, setSelectedSport] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [selectedCourt, setSelectedCourt] = useState('');
    const [timeSlot, setTimeSlot] = useState('');
    const [customStartTime, setCustomStartTime] = useState('09:00');
    const [customEndTime, setCustomEndTime] = useState('10:00');
    const [teamName, setTeamName] = useState(''); // NEW
    const [maxPlayers, setMaxPlayers] = useState(5); // NEW: Dynamic team size

    // --- Package & Member Selection ---
    const [selectedPackageId, setSelectedPackageId] = useState('');
    // For simplicity right now, when creating a NEW team, we onboard 1 member initially. 
    // They can manage members later, or we can add multi-select. Let's do multi-select for new teams.
    const [teamMembers, setTeamMembers] = useState([]);

    // --- Payment State ---
    const [discountAmount, setDiscountAmount] = useState(0);
    const [discountReason, setDiscountReason] = useState('');
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [onlinePaymentType, setOnlinePaymentType] = useState('UPI');
    const [paymentId, setPaymentId] = useState('');
    const [errors, setErrors] = useState({});

    const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);

    const fetchInitialData = useCallback(async () => {
        try {
            const [sportsRes, packagesRes, courtsRes, teamsRes] = await Promise.all([
                api.get('/sports'),
                api.get('/memberships/packages'),
                api.get('/courts'),
                api.get('/memberships/teams')
            ]);
            setSports(sportsRes.data);
            setPackages(packagesRes.data);
            setCourts(courtsRes.data);
            setActiveTeams(teamsRes.data);
        } catch (err) {
            console.error("Failed to fetch initial data", err);
            setError("Failed to load initial data. Please refresh the page.");
        }
    }, []);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    const formatTime = (timeString) => {
        if (!timeString) return '';
        const [hour, minute] = timeString.split(':');
        const date = new Date();
        date.setHours(hour, minute);
        return format(date, 'hh:mm a');
    };

    const effectiveTimeSlot = useMemo(() => {
        if (timeSlot === 'custom') {
            const formattedStart = formatTime(customStartTime);
            const formattedEnd = formatTime(customEndTime);
            return `${formattedStart} - ${formattedEnd}`;
        }
        return timeSlot;
    }, [timeSlot, customStartTime, customEndTime]);

    // Derived states
    const selectedTeam = useMemo(() => activeTeams.find(t => t.id === parseInt(selectedTeamId)), [activeTeams, selectedTeamId]);
    const selectedPackage = useMemo(() => packages.find(p => p.id === parseInt(selectedPackageId)), [selectedPackageId, packages]);

    const { basePrice, finalPrice } = useMemo(() => {
        if (!selectedPackage || teamMembers.length === 0) return { basePrice: 0, finalPrice: 0 };
        const base = (selectedPackage.per_person_price || 0) * teamMembers.length;
        const final = base - (discountAmount || 0);
        return { basePrice: base, finalPrice: Math.max(0, final) };
    }, [selectedPackage, teamMembers, discountAmount]);

    // Validation Flags
    const isStep1Complete = onboardingMode === 'new_team' 
        ? (selectedSport && teamName && selectedCourt && timeSlot)
        : (selectedTeamId !== '');

    const isStep2Complete = selectedPackageId && startDate && teamMembers.length > 0;

    const handleAddMember = (member) => {
        if (!teamMembers.some(tm => tm.id === member.id)) {
            setTeamMembers([...teamMembers, member]);
        }
        setIsAddMemberModalOpen(false);
    };

    const handleRemoveMember = (memberId) => {
        setTeamMembers(teamMembers.filter(m => m.id !== memberId));
    };

    const handleStep1Next = async () => {
        setError('');
        if (onboardingMode === 'new_team') {
            // Check clash for new team
            setLoading(true);
            try {
                // Let the backend validate the clash
                const res = await api.post('/memberships/teams', { 
                    dry_run: true,
                    court_id: selectedCourt,
                    time_slot: effectiveTimeSlot,
                    sport_id: selectedSport,
                    name: 'Validation',
                    max_players: 1
                }).catch(e => e.response);
                
                if (res && res.status >= 400 && res.data?.is_clashing) {
                     setError(res.data.message || "Conflict found for this time slot.");
                     setLoading(false);
                     return;
                }
            } catch (err) { }
            finally { setLoading(false); }
        }
        setStep(2);
    };

    const validateForm = () => {
        const newErrors = {};
        if (paymentAmount === '' || paymentAmount === null) {
            newErrors.paymentAmount = 'Amount received is required.';
        } else if (isNaN(paymentAmount) || parseFloat(paymentAmount) < 0) {
            newErrors.paymentAmount = 'Invalid amount.';
        } else if (parseFloat(paymentAmount) > finalPrice) {
            newErrors.paymentAmount = 'Cannot exceed final price.';
        }
        if (isNaN(discountAmount) || parseFloat(discountAmount) < 0) {
            newErrors.discountAmount = 'Invalid discount.';
        } else if (parseFloat(discountAmount) > basePrice) {
             newErrors.discountAmount = 'Discount cannot exceed base price.';
        }
        if ((parseFloat(discountAmount) > 0) && !discountReason.trim()) {
            newErrors.discountReason = 'Reason required.';
        }
        if ((paymentMode === 'Online' || paymentMode === 'Cheque') && !paymentId.trim()) {
            newErrors.paymentId = (paymentMode === 'Cheque' ? 'Cheque ID' : 'Payment ID') + ' required.';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const resetForm = () => {
        setStep(1);
        setSelectedSport('');
        setSelectedPackageId('');
        setSelectedCourt('');
        setTeamMembers([]);
        setTeamName('');
        setMaxPlayers(5);
        setSelectedTeamId('');
        setDiscountAmount(0);
        setDiscountReason('');
        setPaymentAmount(0);
        setPaymentMode('Cash');
        setOnlinePaymentType('UPI');
        setPaymentId('');
        setStartDate(new Date().toISOString().slice(0, 10));
        setTimeSlot('');
        setErrors({});
        setError('');
        fetchInitialData();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!validateForm()) return;

        setLoading(true);
        const finalPaymentMode = paymentMode === 'Online' ? onlinePaymentType : paymentMode;
        const finalPaymentId = (paymentMode === 'Online' || paymentMode === 'Cheque') ? paymentId : null;

        try {
            let targetTeamId = parseInt(selectedTeamId);

            // Create Team if mode is new_team
            if (onboardingMode === 'new_team') {
                const teamRes = await api.post('/memberships/teams', {
                    name: teamName,
                    court_id: selectedCourt,
                    time_slot: effectiveTimeSlot,
                    sport_id: selectedSport,
                    max_players: parseInt(maxPlayers) // Dynamic max players
                });
                targetTeamId = teamRes.data.team_id; // Match backend response property team_id
            }

            // Now subscribe each member to this team
            for (const member of teamMembers) {
                 await api.post('/memberships/subscribe', {
                     team_id: parseInt(targetTeamId),
                     package_id: parseInt(selectedPackageId),
                     member_id: member.id,
                     start_date: startDate,
                     // Divide the total payment proportionately for simplicity in bulk UI 
                     discount_amount: parseFloat(discountAmount) / teamMembers.length || 0,
                     discount_details: discountReason,
                     initial_payment: {
                         amount: parseFloat(paymentAmount) / teamMembers.length || 0,
                         payment_mode: finalPaymentMode,
                         payment_id: finalPaymentId
                     }
                 });
            }

            alert('Membership(s) created successfully!');
            resetForm();
        } catch (err) {
            console.error("Subscription Error:", err);
            setError(err.response?.data?.message || 'An error occurred during subscription.');
        } finally {
            setLoading(false);
        }
    };

    // UI Helpers
    const filteredPackages = selectedSport ? packages.filter(p => p.sport_id === parseInt(selectedSport)) : packages;
    const filteredCourts = selectedSport ? courts.filter(c => c.sport_id === parseInt(selectedSport)) : courts;


    const renderStep1 = () => (
        <div className="form-step">
            <h4>Step 1: Venue & Team Selection</h4>
            
            <div className="onboarding-mode-toggle">
                <button type="button" className={`mode-btn ${onboardingMode === 'new_team' ? 'active' : ''}`} onClick={() => setOnboardingMode('new_team')}>
                    Create New Team Reservation
                </button>
                <button type="button" className={`mode-btn ${onboardingMode === 'existing_team' ? 'active' : ''}`} onClick={() => setOnboardingMode('existing_team')}>
                    Join Existing Active Team
                </button>
            </div>

            {onboardingMode === 'new_team' && (
                <>
                    <div className="form-group">
                        <label>Sport</label>
                        <select value={selectedSport} onChange={e => setSelectedSport(e.target.value)} required>
                            <option value="" disabled>Select a sport</option>
                            {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Team Name (e.g., Morning Batches / John's Squad)</label>
                        <input type="text" value={teamName} onChange={e => setTeamName(e.target.value)} required placeholder="Enter team nickname" />
                    </div>
                    <div className="form-group">
                        <label>Team Size (Max Players)</label>
                        <input type="number" value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} min="1" max="50" required />
                    </div>
                    <div className="form-group">
                        <label>Designated Court</label>
                        <select value={selectedCourt} onChange={e => setSelectedCourt(e.target.value)} required disabled={!selectedSport}>
                            <option value="" disabled>Select a court</option>
                            {filteredCourts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Daily Time Slot</label>
                        <select value={timeSlot} onChange={e => setTimeSlot(e.target.value)} required>
                            <option value="" disabled>Select a time slot</option>
                            {Array.from({ length: 17 }, (_, i) => {
                                const hour = i + 6; 
                                const start = `${hour % 12 === 0 ? 12 : hour % 12}:00 ${hour < 12 ? 'AM' : 'PM'}`;
                                const endHour = hour + 1;
                                const end = `${endHour % 12 === 0 ? 12 : endHour % 12}:00 ${endHour < 12 || endHour === 24 ? 'AM' : 'PM'}`;
                                return <option key={hour} value={`${start} - ${end}`}>{`${start} - ${end}`}</option>
                            })}
                            <option value="custom">Custom Time</option>
                        </select>
                    </div>
                    {timeSlot === 'custom' && (
                        <div className="custom-time-inputs">
                            <div className="form-group"><label>Start Time</label><input type="time" value={customStartTime} onChange={e => setCustomStartTime(e.target.value)} /></div>
                            <div className="form-group"><label>End Time</label><input type="time" value={customEndTime} onChange={e => setCustomEndTime(e.target.value)} /></div>
                        </div>
                    )}
                </>
            )}

            {onboardingMode === 'existing_team' && (
                <div className="form-group">
                    <label>Select Team ({activeTeams.length} Active)</label>
                    <select value={selectedTeamId} onChange={e => {
                        setSelectedTeamId(e.target.value);
                        const t = activeTeams.find(team => team.id === parseInt(e.target.value));
                        if(t) setSelectedSport(t.sport_id); // Sync sport for package filtering
                    }} required size="8" className="team-select-box">
                        <option value="" disabled>Select an available team below...</option>
                        {activeTeams.map(t => (
                            <option key={t.id} value={t.id} disabled={t.current_members >= t.max_players}>
                                {t.name} | {t.court_name} | {t.time_slot} ({t.current_members}/{t.max_players} members) {t.current_members >= t.max_players ? '- FULL' : ''}
                            </option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    );

    const renderStep2 = () => {
        let maxAllowed = parseInt(maxPlayers) || 5; // Default to maxPlayers state if new team
        if (onboardingMode === 'existing_team' && selectedTeam) {
             maxAllowed = selectedTeam.max_players - selectedTeam.current_members;
        }

        const teamIsFull = teamMembers.length >= maxAllowed;

        return (
            <div className="form-step">
                <h4>Step 2: Assign Package & Add Members</h4>
                <div className="form-group">
                    <label>Membership Package</label>
                    <select value={selectedPackageId} onChange={e => setSelectedPackageId(e.target.value)} required>
                        <option value="" disabled>Select a package</option>
                        {filteredPackages.map(p => <option key={p.id} value={p.id}>{p.name} ({p.duration_days} days)</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label>Start Date for these members</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                </div>

                <div className="team-management">
                    <h5>Members ({teamMembers.length}/{maxAllowed} allowed)</h5>
                    <button type="button" className="btn btn-primary" onClick={() => setIsAddMemberModalOpen(true)} disabled={teamIsFull || !selectedPackageId}>
                        + Add Member
                    </button>
                    {teamIsFull && <p className="team-full-message">Capacity reached for this addition.</p>}
                    <ul className="team-member-list">
                        {teamMembers.map(member => (
                            <li key={member.id}>
                                <span>{member.full_name} ({member.phone_number})</span>
                                <button type="button" className="remove-btn" onClick={() => handleRemoveMember(member.id)}>&times;</button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        );
    };

    const renderStep3 = () => (
        <div className="form-step">
            <h4>Step 3: Finalize and Pay</h4>
            {/* Same UI as before, rendering summary and payment inputs */}
            <div className="step3-cards-container">
                <div className="summary-card">
                    <h5>Subscription Summary</h5>
                    <p><strong>Team:</strong> {onboardingMode === 'new_team' ? teamName : selectedTeam?.name}</p>
                    <p><strong>Package:</strong> {selectedPackage?.name}</p>
                    <p><strong>Members Adding:</strong> {teamMembers.length}</p>
                    <p><strong>Base Price:</strong> Rs. {basePrice.toFixed(2)}</p>
                    <p className="final-price"><strong>Final Price:</strong> Rs. {finalPrice.toFixed(2)}</p>
                </div>
                <div className="payment-card">
                    <h5>Initial Payment Collect</h5>
                    <div className="form-group">
                        <label>Discount Amount (Rs.)</label>
                        <input type="number" value={discountAmount} onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)} />
                        {errors.discountAmount && <span className="error-text">{errors.discountAmount}</span>}
                    </div>
                    {discountAmount > 0 && (
                        <div className="form-group">
                            <label>Discount Reason</label>
                            <input type="text" value={discountReason} onChange={e => setDiscountReason(e.target.value)} placeholder="e.g. Employee Referral" required />
                            {errors.discountReason && <span className="error-text">{errors.discountReason}</span>}
                        </div>
                    )}
                    <div className="form-group">
                        <label>Amount Received</label>
                        <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)} max={finalPrice} />
                        {errors.paymentAmount && <span className="error-text">{errors.paymentAmount}</span>}
                    </div>
                    <div className="form-group">
                        <label>Payment Mode</label>
                        <select value={paymentMode} onChange={e => {
                            setPaymentMode(e.target.value);
                            setPaymentId(''); // Reset ID when mode changes
                        }}>
                            <option value="Cash">Cash</option><option value="Online">Online</option><option value="Cheque">Cheque</option>
                        </select>
                    </div>
                    {paymentMode === 'Online' && (
                        <div className="form-group">
                            <label>Online Payment Type</label>
                            <select value={onlinePaymentType} onChange={e => setOnlinePaymentType(e.target.value)}>
                                <option value="UPI">UPI</option>
                                <option value="Card">Card</option>
                                <option value="Net Banking">Net Banking</option>
                            </select>
                        </div>
                    )}
                    {(paymentMode === 'Online' || paymentMode === 'Cheque') && (
                        <div className="form-group">
                            <label>{paymentMode === 'Cheque' ? 'Cheque ID' : 'Payment ID / Ref'}</label>
                            <input type="text" value={paymentId} onChange={e => setPaymentId(e.target.value)} />
                            {errors.paymentId && <span className="error-text">{errors.paymentId}</span>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="new-subscription-container">
            <div className="subscription-form-content">
                <h3>Membership Onboarding</h3>
                {error && <p className="error-message">{error}</p>}
                
                <div className="stepper-container">
                    <div className={`step-item ${step >= 1 ? 'active' : ''}`}><div className="step-counter">1</div><div className="step-name">Team</div></div>
                    <div className={`step-item ${step >= 2 ? 'active' : ''}`}><div className="step-counter">2</div><div className="step-name">Members</div></div>
                    <div className={`step-item ${step >= 3 ? 'active' : ''}`}><div className="step-counter">3</div><div className="step-name">Payment</div></div>
                </div>

                <form onSubmit={handleSubmit}>
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}

                    <div className="form-navigation">
                        {step > 1 && <button type="button" className="btn btn-secondary" style={{ marginRight: 'auto' }} onClick={() => setStep(step - 1)} disabled={loading}>&lt; Back</button>}
                        {step === 1 && <button type="button" className="btn btn-primary" onClick={handleStep1Next} disabled={!isStep1Complete || loading}>Next &gt;</button>}
                        {step === 2 && <button type="button" className="btn btn-primary" onClick={() => setStep(3)} disabled={!isStep2Complete || loading}>Next &gt;</button>}
                        {step === 3 && <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Processing...' : 'Complete Onboarding'}</button>}
                    </div>

                </form>
            </div>

            {isAddMemberModalOpen && (
                <AddMemberModal onAddMember={handleAddMember} onClose={() => setIsAddMemberModalOpen(false)} />
            )}
        </div>
    );
};

export default NewSubscription;