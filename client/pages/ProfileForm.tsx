import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { DOMAINS, DIFFICULTIES, LANGUAGES, EXPERIENCE_LEVELS, JOB_SEEKER_EXPERIENCE, USER_TYPES, EDUCATION_LEVELS, GENDERS, COUNTRY_CODES, LOCATION_DATA, Icons } from '../constants';
import { UserProfile } from '../types';

const ProfileForm: React.FC = () => {
  const { profile, updateProfileExtras } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    name: '',
    phoneNumber: '',
    countryCode: COUNTRY_CODES[2].code, // Default to India (+91)
    country: '',
    city: '',
    bio: '',
    gender: '',
    userType: undefined,
    educationLevel: '',
    fieldOfStudy: '',
    industry: '',
    yearsExperience: 0,
    targetRole: '',
    experienceLevel: '',
    preferredLanguage: LANGUAGES[0],
    defaultDifficulty: DIFFICULTIES[1],
    theme: 'Light',
    skills: [],
    profileImage: '',
    voicePreference: undefined
  });
  
  const [skillInput, setSkillInput] = useState('');
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const suggestedSkills = [
    'React',
    'TypeScript',
    'JavaScript',
    'Python',
    'Java',
    'Node.js',
    'SQL',
    'MySQL',
    'AWS',
    'Docker',
    'Data Analysis',
    'Project Management',
    'Communication',
    'Problem Solving',
    'Leadership',
    'UI/UX Design',
    'Machine Learning',
    'System Design',
  ];

  const validateSkill = (rawSkill: string) => {
    const skill = rawSkill.trim().replace(/\s+/g, ' ');
    if (!skill) return 'Enter a skill first';
    if ((formData.skills || []).length >= 20) return 'You can add up to 20 skills';
    if ((formData.skills || []).some(existing => existing.toLowerCase() === skill.toLowerCase())) return 'Skill already added';
    if (skill.length < 2) return 'Skill is too short';
    if (skill.length > 40) return 'Skill must be 40 characters or less';
    if (/^\d+$/.test(skill)) return 'Skill cannot be only numbers';
    if (/(.)\1{3,}/i.test(skill)) return 'Skill has too many repeated characters';
    if (!/[a-z]/i.test(skill)) return 'Skill must include letters';
    if (!/^[a-z0-9][a-z0-9+#./& -]*$/i.test(skill)) return 'Skill contains unsupported characters';
    if (skill.split(' ').length > 4) return 'Keep each skill short and specific';
    if (/^(asdf|qwer|test|testing|abc|abcd|none|na|n\/a|random|fake|sample)$/i.test(skill)) return 'Add a real professional skill';
    return '';
  };

  useEffect(() => {
    if (!profile) return;
    setFormData({
      ...profile,
      name: profile.name || '',
      phoneNumber: profile.phoneNumber || '',
      countryCode: profile.countryCode || COUNTRY_CODES[2].code,
      country: profile.country || '',
      city: profile.city || '',
      bio: profile.bio || '',
      gender: profile.gender || '',
      userType: profile.userType,
      educationLevel: profile.educationLevel || '',
      fieldOfStudy: profile.fieldOfStudy || '',
      industry: profile.industry || '',
      yearsExperience: profile.yearsExperience || 0,
      targetRole: profile.targetRole || '',
      experienceLevel: profile.experienceLevel || '',
      preferredLanguage: profile.preferredLanguage || LANGUAGES[0],
      defaultDifficulty: profile.defaultDifficulty || DIFFICULTIES[1],
      theme: profile.theme || 'Light',
      skills: profile.skills || [],
      profileImage: profile.profileImage || '',
      voicePreference: profile.voicePreference,
    });
  }, [profile]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError("Image size must be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, profileImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const addSkill = (e?: React.KeyboardEvent, suggestedSkill?: string) => {
    if (e && e.key !== 'Enter') return;
    if (e) e.preventDefault();
    
    const trimmed = (suggestedSkill || skillInput).trim().replace(/\s+/g, ' ');
    const validationError = validateSkill(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (trimmed) {
      setFormData(prev => ({ ...prev, skills: [...(prev.skills || []), trimmed] }));
      setSkillInput('');
      setError('');
    }
  };

  const removeSkill = (skill: string) => {
    setFormData(prev => ({ ...prev, skills: prev.skills?.filter(s => s !== skill) }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!formData.name) return setError("Name is required");
    if (!formData.gender) return setError("Gender is required");
    if (!formData.country) return setError("Country is required");
    if (!formData.city) return setError("City is required");
    if (!formData.userType) return setError("Please select your user type.");
    if (!formData.voicePreference) return setError("Please select a voice preference.");
    if (!formData.phoneNumber || !/^\d{10}$/.test(formData.phoneNumber)) return setError("Please enter a valid 10-digit phone number");
    const validatedSkills = (formData.skills || []).map(skill => skill.trim()).filter(Boolean);
    if (validatedSkills.length < 5) return setError("Please add at least 5 tech or non-tech professional skills");
    if (validatedSkills.length > 20) return setError("You can add up to 20 professional skills");
    const normalizedSkillNames = new Set<string>();
    for (const skill of validatedSkills) {
      const skillKey = skill.toLowerCase();
      if (normalizedSkillNames.has(skillKey)) return setError(`${skill}: Duplicate skill`);
      normalizedSkillNames.add(skillKey);
      const validationError = validateSkillWithList(skill);
      if (validationError) return setError(`${skill}: ${validationError}`);
    }

    setLoading(true);
    try {
      await updateProfileExtras({ ...formData, skills: validatedSkills });
      
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const validateSkillWithList = (rawSkill: string) => {
    const skill = rawSkill.trim().replace(/\s+/g, ' ');
    if (!skill) return 'Skill cannot be empty';
    if (skill.length < 2) return 'Skill is too short';
    if (skill.length > 40) return 'Skill must be 40 characters or less';
    if (/^\d+$/.test(skill)) return 'Skill cannot be only numbers';
    if (/(.)\1{3,}/i.test(skill)) return 'Skill has too many repeated characters';
    if (!/[a-z]/i.test(skill)) return 'Skill must include letters';
    if (!/^[a-z0-9][a-z0-9+#./& -]*$/i.test(skill)) return 'Skill contains unsupported characters';
    if (skill.split(' ').length > 4) return 'Keep each skill short and specific';
    if (/^(asdf|qwer|test|testing|abc|abcd|none|na|n\/a|random|fake|sample)$/i.test(skill)) return 'Add a real professional skill';
    return '';
  };

  if (!profile) return null;

  const availableCities = formData.country ? LOCATION_DATA[formData.country] || [] : [];

  const inputClass = "w-full bg-slate-50 dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 focus:bg-white dark:focus:bg-slate-700 text-slate-900 dark:text-neutral-100 font-bold transition-all";
  const labelClass = "block text-[10px] font-black text-slate-400 dark:text-neutral-400 uppercase tracking-widest mb-2 ml-1";

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="bg-white dark:bg-neutral-900 rounded-[3rem] border border-slate-100 dark:border-neutral-800 shadow-2xl p-8 md:p-12 transition-colors duration-200">
          
          <div className="flex flex-col md:flex-row items-center gap-10 mb-12 border-b border-slate-50 dark:border-neutral-800 pb-10">
            <div className="relative group">
              <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden bg-slate-50 dark:bg-neutral-950 border-4 border-white dark:border-neutral-800 shadow-xl ring-2 ring-blue-50 dark:ring-blue-900/20">
                <img 
                  src={formData.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.email}`} 
                  className="w-full h-full object-cover" 
                  alt="Profile"
                />
              </div>
              <button 
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-2.5 rounded-xl shadow-lg hover:bg-blue-700 transition-all scale-90 group-hover:scale-100"
                title="Change Photo"
              >
                <Icons.Camera />
              </button>
              <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleImageChange} />
            </div>
            <div className="text-center md:text-left">
              <h1 className="text-4xl font-black text-slate-900 dark:text-neutral-100 mb-2 font-poppins">Build Your Profile</h1>
              <p className="text-slate-500 dark:text-neutral-400 font-medium text-lg">Detailed context helps AceMock AI generate better questions.</p>
            </div>
          </div>

          {error && (
            <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-sm font-bold border border-red-100 dark:border-red-900/30 animate-shake flex items-center gap-3">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
               {error}
            </div>
          )}

          {success && (
            <div className="mb-8 p-6 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-2xl text-lg font-bold border border-emerald-100 dark:border-emerald-900/30 flex flex-col items-center gap-3 text-center">
               <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-800 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-300 text-2xl">✓</div>
               Profile successfully updated!
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-12">
            
            <section className="space-y-8">
              <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                 <Icons.Profile />
                 <h2 className="text-xs font-black uppercase tracking-[0.2em]">Required Information</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className={labelClass}>Full Name *</label>
                  <input 
                    type="text" 
                    required
                    className={inputClass}
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>Gender *</label>
                  <select 
                    required
                    className={inputClass + " cursor-pointer"}
                    value={formData.gender}
                    onChange={e => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                  >
                    <option value="">Select Gender</option>
                    {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className={labelClass}>Phone Number *</label>
                  <div className="flex gap-2">
                    <select 
                      className="w-24 bg-slate-50 dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 rounded-2xl px-2 outline-none text-slate-900 dark:text-neutral-100 font-bold"
                      value={formData.countryCode}
                      onChange={e => setFormData(prev => ({ ...prev, countryCode: e.target.value }))}
                    >
                      {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                    </select>
                    <input 
                      type="tel" 
                      required
                      maxLength={10}
                      className="flex-grow bg-slate-50 dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 text-slate-900 dark:text-neutral-100 font-bold"
                      placeholder="10 digit number"
                      value={formData.phoneNumber}
                      onChange={e => setFormData(prev => ({ ...prev, phoneNumber: e.target.value.replace(/\D/g, '') }))}
                    />
                  </div>
                </div>
                <div>
                   <label className={labelClass}>Country *</label>
                   <select 
                    required
                    className={inputClass + " cursor-pointer"}
                    value={formData.country}
                    onChange={e => setFormData(prev => ({ ...prev, country: e.target.value, city: '' }))}
                  >
                    <option value="">Select Country</option>
                    {Object.keys(LOCATION_DATA).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className={labelClass}>City *</label>
                  <select 
                    required
                    disabled={!formData.country}
                    className={inputClass + " cursor-pointer disabled:opacity-50"}
                    value={formData.city}
                    onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  >
                    <option value="">Select City</option>
                    {availableCities.map(city => <option key={city} value={city}>{city}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Short Bio (Max 150 chars)</label>
                  <textarea 
                    maxLength={150}
                    className={inputClass + " resize-none h-[58px] overflow-hidden"}
                    placeholder="Tell us about yourself..."
                    value={formData.bio}
                    onChange={e => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-8 pt-8 border-t border-slate-50 dark:border-neutral-800">
              <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
                 <Icons.Interview />
                 <h2 className="text-xs font-black uppercase tracking-[0.2em]">I am a... *</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'Student', label: 'Student', icon: '🎓' },
                  { id: 'Working Professional', label: 'Professional', icon: '💼' },
                  { id: 'Job Seeker', label: 'Job Seeker', icon: '🔍' }
                ].map(type => (
                  <label key={type.id} className={`relative flex items-center gap-4 p-5 rounded-3xl border-2 transition-all cursor-pointer ${formData.userType === type.id ? 'border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md' : 'border-slate-100 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 hover:border-slate-200 dark:hover:border-slate-600'}`}>
                    <input 
                      type="radio" 
                      name="userType" 
                      className="w-5 h-5 text-blue-600 dark:text-blue-500 focus:ring-blue-500" 
                      checked={formData.userType === type.id}
                      onChange={() => setFormData(prev => ({ ...prev, userType: type.id as any }))}
                    />
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{type.icon}</span>
                      <span className="font-bold text-slate-900 dark:text-neutral-100">{type.label}</span>
                    </div>
                  </label>
                ))}
              </div>

              {formData.userType === 'Student' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div>
                    <label className={labelClass}>Education Level *</label>
                    <select 
                      className={inputClass}
                      value={formData.educationLevel}
                      onChange={e => setFormData(prev => ({ ...prev, educationLevel: e.target.value }))}
                    >
                      <option value="">Select Level</option>
                      {EDUCATION_LEVELS.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Field of Study *</label>
                    <input 
                      type="text" 
                      className={inputClass}
                      placeholder="e.g. Computer Science"
                      value={formData.fieldOfStudy}
                      onChange={e => setFormData(prev => ({ ...prev, fieldOfStudy: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {formData.userType === 'Working Professional' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div>
                    <label className={labelClass}>Years of Experience *</label>
                    <select 
                      className={inputClass}
                      value={formData.yearsExperience}
                      onChange={e => setFormData(prev => ({ ...prev, yearsExperience: parseInt(e.target.value) }))}
                    >
                      {[0,1,2,3,4,5,6,7,8,9,10,15,20].map(y => <option key={y} value={y}>{y === 0 ? 'Fresher' : `${y}+ Years`}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Industry *</label>
                    <input 
                      type="text" 
                      className={inputClass}
                      placeholder="e.g. Finance, Tech, Health"
                      value={formData.industry}
                      onChange={e => setFormData(prev => ({ ...prev, industry: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {formData.userType === 'Job Seeker' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div>
                    <label className={labelClass}>Experience Level *</label>
                    <select 
                      className={inputClass}
                      value={formData.experienceLevel}
                      onChange={e => setFormData(prev => ({ ...prev, experienceLevel: e.target.value }))}
                    >
                      <option value="">Select Level</option>
                      {JOB_SEEKER_EXPERIENCE.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Target Role *</label>
                    <input 
                      type="text" 
                      className={inputClass}
                      placeholder="e.g. Senior Frontend Engineer"
                      value={formData.targetRole}
                      onChange={e => setFormData(prev => ({ ...prev, targetRole: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              <div className="pt-8 border-t border-slate-50 dark:border-neutral-800">
                <label className={labelClass}>Professional Skills (Min 5) *</label>
                <div className="flex flex-wrap gap-2 mb-4">
                  {formData.skills?.map(skill => (
                    <span key={skill} className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold border border-blue-100 dark:border-blue-900/50 flex items-center gap-2">
                      {skill}
                      <button type="button" onClick={() => removeSkill(skill)} className="hover:text-red-500 transition-colors font-black">×</button>
                    </span>
                  ))}
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    className={inputClass}
                    placeholder="Add skills (e.g. React, Python)..."
                    value={skillInput}
                    onChange={e => setSkillInput(e.target.value)}
                    onKeyDown={addSkill}
                  />
                  <button 
                    type="button" 
                    onClick={() => addSkill()}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-600 dark:text-blue-400 font-bold text-sm uppercase tracking-widest"
                  >
                    Add
                  </button>
                </div>
                <div className="mt-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-400 mb-3 ml-1">
                    Suggested Skills
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedSkills.map(skill => {
                      const isSelected = (formData.skills || []).some(existing => existing.toLowerCase() === skill.toLowerCase());
                      return (
                        <button
                          key={skill}
                          type="button"
                          disabled={isSelected || (formData.skills || []).length >= 20}
                          onClick={() => addSkill(undefined, skill)}
                          className={`px-3 py-2 rounded-xl text-xs font-black border transition-all ${
                            isSelected
                              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/40 cursor-default'
                              : 'bg-slate-50 dark:bg-neutral-950 text-slate-600 dark:text-neutral-300 border-slate-100 dark:border-neutral-800 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed'
                          }`}
                        >
                          {isSelected ? 'Added ' : '+ '}
                          {skill}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs font-semibold text-slate-400 dark:text-neutral-400">
                    Add 5 to 20 real professional skills. Custom skills must be specific and readable.
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-8 pt-8 border-t border-slate-50 dark:border-neutral-800">
              <div className="flex items-center gap-3 text-blue-500 dark:text-blue-400">
                 <Icons.Mic />
                 <h2 className="text-xs font-black uppercase tracking-[0.2em]">Voice Preference</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
                <label className={`relative flex items-center gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer ${formData.voicePreference === 'male' ? 'border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md' : 'border-slate-100 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 hover:border-slate-200 dark:hover:border-slate-600'}`}>
                  <input 
                    type="radio" 
                    name="voicePreference" 
                    className="w-5 h-5 text-blue-600 dark:text-blue-500" 
                    checked={formData.voicePreference === 'male'}
                    onChange={() => setFormData(prev => ({ ...prev, voicePreference: 'male' }))}
                  />
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">👨</span>
                    <span className="font-bold text-slate-900 dark:text-neutral-100">Male Voice</span>
                  </div>
                </label>

                <label className={`relative flex items-center gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer ${formData.voicePreference === 'female' ? 'border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md' : 'border-slate-100 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 hover:border-slate-200 dark:hover:border-slate-600'}`}>
                  <input 
                    type="radio" 
                    name="voicePreference" 
                    className="w-5 h-5 text-blue-600 dark:text-blue-500" 
                    checked={formData.voicePreference === 'female'}
                    onChange={() => setFormData(prev => ({ ...prev, voicePreference: 'female' }))}
                  />
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">👩</span>
                    <span className="font-bold text-slate-900 dark:text-neutral-100">Female Voice</span>
                  </div>
                </label>
              </div>
            </section>

            <section className="space-y-8 pt-8 border-t border-slate-50 dark:border-neutral-800">
               <div className="flex items-center gap-3 text-slate-600 dark:text-neutral-400">
                 <Icons.Settings />
                 <h2 className="text-xs font-black uppercase tracking-[0.2em]">Application Theme</h2>
              </div>

              <div>
                <div className="flex gap-4 max-w-sm">
                  {['Light', 'Dark'].map(theme => (
                    <button
                      key={theme}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, theme: theme as any }))}
                      className={`flex-1 py-4 rounded-2xl font-bold transition-all ${
                        formData.theme === theme 
                        ? 'bg-slate-900 dark:bg-neutral-100 text-white dark:text-neutral-950 shadow-xl' 
                        : 'bg-slate-50 dark:bg-neutral-950 text-slate-400 dark:text-neutral-400 border border-slate-100 dark:border-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      {theme}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <div className="flex flex-col md:flex-row gap-6 pt-10">
              <button 
                type="submit" 
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-5 rounded-[2rem] font-black text-xl hover:bg-blue-700 transition shadow-2xl shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-4"
              >
                {loading ? (
                  <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : "Save Profile"}
              </button>
              <div className="flex gap-4 md:w-1/3">
                 <button 
                  type="button" 
                  onClick={() => navigate('/dashboard')}
                  className="flex-1 bg-slate-50 dark:bg-neutral-950 text-slate-500 dark:text-neutral-400 py-5 rounded-[2rem] font-bold hover:bg-slate-100 dark:hover:bg-neutral-800 transition"
                >
                  Skip
                </button>
                <button 
                  type="button" 
                  onClick={() => navigate('/dashboard')}
                  className="flex-1 bg-white dark:bg-neutral-900 text-red-500 border border-red-50 dark:border-red-900/30 py-5 rounded-[2rem] font-bold hover:bg-red-50 dark:hover:bg-red-900/10 transition"
                >
                  Cancel
                </button>
              </div>
            </div>

          </form>

        </div>
      </div>
    </Layout>
  );
};

export default ProfileForm;
