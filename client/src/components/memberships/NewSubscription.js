import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../api';
import AddMemberModal from './AddMemberModal';
import './NewSubscription.css';
import { format } from 'date-fns';

const NewSubscription = () => {
    const [step, setStep] = useState(1);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const [packages, setPackages] = useState([]);
    const [sports, setSports] = useState([]);
    const [courts, setCourts] = useState([]);

    // Form data state
    const [selectedSport, setSelectedSport] = useState('');
    const [selectedPackageId, setSelectedPackageId] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [selectedCourt, setSelectedCourt] = useState('');
    const [timeSlot, setTimeSlot] = useState('');
    const [customStartTime, setCustomStartTime] = useState('09:00');
    const [customEndTime, setCustomEndTime] = useState('10:00');
    const [teamMembers, setTeamMembers] = useState([]);

    // Step 3 state
    const [discountAmount, setDiscountAmount] = useState(0);
    const [discountReason, setDiscountReason] = useState('');
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [paymentMode, setPaymentMode] = useState('Cash');

    const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);

    // Derived state for validation
    const isStep1Complete = selectedSport && selectedPackageId && selectedCourt && startDate && timeSlot;
    const isStep2Complete = teamMembers.length > 0;

    const fetchInitialData = useCallback(async () => {
        try {
            const [sportsRes, packagesRes, courtsRes] = await Promise.all([
                api.get('/sports'),
                api.get('/memberships/packages'),
                api.get('/courts')
            ]);
            setSports(sportsRes.data);
            setPackages(packagesRes.data);
            setCourts(courtsRes.data);
        } catch (err) {
            console.error("Failed to fetch initial data", err);
            setError("Failed to load initial data. Please refresh the page.");
        }
    }, []);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    const selectedPackage = useMemo(() => {
        return packages.find(p => p.id === parseInt(selectedPackageId));
    }, [selectedPackageId, packages]);

    const { basePrice, finalPrice } = useMemo(() => {
        if (!selectedPackage || teamMembers.length === 0) {
            return { basePrice: 0, finalPrice: 0 };
        }
        const base = (selectedPackage.per_person_price || 0) * teamMembers.length;
        const final = base - (discountAmount || 0);
        return { basePrice: base, finalPrice: final };
    }, [selectedPackage, teamMembers, discountAmount]);


    const handleAddMember = (member) => {
        if (!teamMembers.some(tm => tm.id === member.id)) {
            setTeamMembers([...teamMembers, member]);
        }
        setIsAddMemberModalOpen(false);
    };

    const handleRemoveMember = (memberId) => {
        setTeamMembers(teamMembers.filter(m => m.id !== memberId));
    };
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


    const handleStep1Next = async () => {
        setError('');
        setLoading(true);
        try {
            const res = await api.post('/memberships/check-clash', {
                package_id: selectedPackageId,
                court_id: selectedCourt,
                start_date: startDate,
                time_slot: effectiveTimeSlot
            });

            if (res.data.is_clashing) {
                setError(res.data.message);
            } else {
                setStep(2);
            }
        } catch (err) {
            console.error("Conflict check failed", err);
            setError("Failed to check for scheduling conflicts. Please try again.");
        } finally {
            setLoading(false);
        }
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!isStep1Complete || !isStep2Complete) {
            setError("Please ensure all steps are complete and valid before submitting.");
            return;
        }
        if (!selectedPackage) {
            setError("The selected package is invalid. Please go back and re-select a package.");
            return;
        }

        setLoading(true);

        const subscriptionData = {
            package_id: selectedPackage.id,
            court_id: selectedCourt,
            start_date: startDate,
            time_slot: effectiveTimeSlot,
            team_members: teamMembers.map(m => ({ member_id: m.id })),
            discount_amount: discountAmount,
            discount_details: discountReason,
            initial_payment: {
                amount: paymentAmount,
                payment_mode: paymentMode
            }
        };

        console.log("Submitting subscription data:", subscriptionData);

        try {
            await api.post('/memberships/subscribe', subscriptionData);
            alert('Membership created successfully!');
            // Reset form
            setStep(1);
            setSelectedSport('');
            setSelectedPackageId('');
            setSelectedCourt(''); // Moved here
            setTeamMembers([]);
            setDiscountAmount(0);
            setPaymentAmount(0);
            setStartDate(new Date().toISOString().slice(0, 10));
            setTimeSlot('');
        } catch (err) {
            console.error("Subscription Error:", err);
            setError(err.response?.data?.message || 'An error occurred during subscription. Check the console for more details.');
        } finally {
            setLoading(false);
        }
    };

    const filteredPackages = selectedSport 
        ? packages.filter(p => p.sport_id === parseInt(selectedSport))
        : [];
    
    const filteredCourts = selectedSport
        ? courts.filter(c => c.sport_id === parseInt(selectedSport))
        : [];


    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                     <div className="form-step">
                        <h4>Step 1: Select Package</h4>
                        <div className="form-group">
                            <label>Sport</label>
                            <select value={selectedSport} onChange={e => setSelectedSport(e.target.value)} required>
                                <option value="" disabled>Select a sport</option>
                                {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Membership Package</label>
                            <select value={selectedPackageId} onChange={e => setSelectedPackageId(e.target.value)} required disabled={!selectedSport}>
                                <option value="" disabled>Select a package</option>
                                {filteredPackages.map(p => <option key={p.id} value={p.id}>{p.name} ({p.duration_days} days)</option>)}
                            </select>
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
                                    const hour = i + 6; // 6 AM to 10 PM (22:00)
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
                                <div className="form-group">
                                    <label>Start Time</label>
                                    <input type="time" value={customStartTime} onChange={e => setCustomStartTime(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>End Time</label>
                                    <input type="time" value={customEndTime} onChange={e => setCustomEndTime(e.target.value)} />
                                </div>
                            </div>
                        )}
                        <div className="form-group">
                            <label>Start Date</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} required />
                        </div>
                    </div>
                );
            case 2:
                const teamIsFull = selectedPackage && teamMembers.length >= selectedPackage.max_team_size;
                return (
                     <div className="form-step">
                        <h4>Step 2: Build Your Team</h4>
                        <p>Max team size for this package: <strong>{selectedPackage?.max_team_size || 'N/A'}</strong></p>
                        <div className="team-management">
                            <button 
                                type="button" 
                                className="btn btn-primary" 
                                onClick={() => setIsAddMemberModalOpen(true)}
                                disabled={teamIsFull}
                            >
                                Add Member
                            </button>
                            {teamIsFull && <p className="team-full-message">The team is full for this package.</p>}
                            <ul className="team-member-list">
                                {teamMembers.map(member => (
                                    <li key={member.id}>
                                        <span>{member.full_name} ({member.phone_number})</span>
                                        <button type="button" className="remove-btn" onClick={() => handleRemoveMember(member.id)}>&times;</button>
                                    </li>
                                ))}
                            </ul>
                            {teamMembers.length === 0 && <p className="no-members-text">No members added to the team yet.</p>}
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="form-step">
                        <h4>Step 3: Finalize and Pay</h4>
                        <div className="summary-card">
                            <h5>Subscription Summary</h5>
                            <p><strong>Package:</strong> {selectedPackage?.name || 'N/A'}</p>
                            <p><strong>Duration:</strong> {selectedPackage?.duration_days || 'N/A'} days</p>
                            <p><strong>Time Slot:</strong> {effectiveTimeSlot}</p>
                            <p><strong>Team Size:</strong> {teamMembers.length} member(s)</p>
                            <hr/>
                            <p><strong>Base Price:</strong> Rs. {basePrice}</p>
                            <div className="form-group">
                                <label>Discount Amount (Rs.)</label>
                                <input type="number" value={discountAmount} onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)} />
                            </div>
                             <div className="form-group">
                                <label>Discount Reason</label>
                                <input type="text" value={discountReason} onChange={e => setDiscountReason(e.target.value)} />
                            </div>
                            <p className="final-price"><strong>Final Price:</strong> Rs. {finalPrice}</p>
                        </div>
                        <div className="payment-card">
                             <h5>Initial Payment</h5>
                             <div className="form-group">
                                <label>Amount Received</label>
                                <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)} max={finalPrice} />
                            </div>
                             <div className="form-group">
                                <label>Payment Mode</label>
                                <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                                    <option>Cash</option>
                                    <option>Card</option>
                                    <option>Online</option>
                                    <option>Cheque</option>
                                </select>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="new-subscription-container">
            <h3>Create New Membership</h3>
            {error && <p className="error-message">{error}</p>}
            <div className="stepper-container">
                <div className={`step-item ${step >= 1 ? 'active' : ''}`}>
                    <div className="step-counter">1</div>
                    <div className="step-name">Package</div>
                </div>
                <div className={`step-item ${step >= 2 ? 'active' : ''}`}>
                    <div className="step-counter">2</div>
                    <div className="step-name">Team</div>
                </div>
                <div className={`step-item ${step >= 3 ? 'active' : ''}`}>
                    <div className="step-counter">3</div>
                    <div className="step-name">Payment</div>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                {renderStepContent()}
                <div className="form-navigation">
                    {step > 1 && <button type="button" className="btn btn-secondary" onClick={() => setStep(step - 1)} disabled={loading}>Back</button>}
                    {step === 1 && <button type="button" className="btn btn-primary" onClick={handleStep1Next} disabled={!isStep1Complete || loading}>Next</button>}
                    {step === 2 && <button type="button" className="btn btn-primary" onClick={() => setStep(3)} disabled={!isStep2Complete || loading}>Next</button>}
                    {step === 3 && <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Submitting...' : 'Create Subscription'}</button>}
                </div>
            </form>

            {isAddMemberModalOpen && (
                <AddMemberModal 
                    onAddMember={handleAddMember}
                    onClose={() => setIsAddMemberModalOpen(false)}
                />
            )}
        </div>
    );
};

export default NewSubscription;