import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi, appointmentsApi, analyticsApi, conversationsApi, clinicApi } from '../services/api';

export const useOverview        = (p='month') => useQuery({queryKey:['analytics','overview',p], queryFn:()=>analyticsApi.overview(p).then(r=>r.data.data), refetchInterval:60000});
export const useFunnel          = (p='month') => useQuery({queryKey:['analytics','funnel',p],   queryFn:()=>analyticsApi.funnel(p).then(r=>r.data.data)});
export const useChannelBreakdown= (p='month') => useQuery({queryKey:['analytics','channels',p], queryFn:()=>analyticsApi.channels(p).then(r=>r.data.data)});
export const useRevenueSeries   = ()          => useQuery({queryKey:['analytics','revenue'],     queryFn:()=>analyticsApi.revenue().then(r=>r.data.data)});

export const useLeads     = (p={}) => useQuery({queryKey:['leads',p],     queryFn:()=>leadsApi.list(p).then(r=>r.data),     keepPreviousData:true});
export const useLead      = (id)   => useQuery({queryKey:['leads',id],    queryFn:()=>leadsApi.getOne(id).then(r=>r.data.data), enabled:!!id});
export const useLeadStats = (p)    => useQuery({queryKey:['leads','stats',p], queryFn:()=>leadsApi.stats(p).then(r=>r.data.data)});

export const useUpdateLead = () => { const qc=useQueryClient(); return useMutation({mutationFn:({id,data})=>leadsApi.update(id,data), onSuccess:()=>qc.invalidateQueries({queryKey:['leads']})}); };
export const useAddLeadNote= () => { const qc=useQueryClient(); return useMutation({mutationFn:({id,text})=>leadsApi.addNote(id,text), onSuccess:(_,{id})=>qc.invalidateQueries({queryKey:['leads',id]})}); };

export const useConversations = (p={}) => useQuery({queryKey:['conversations',p], queryFn:()=>conversationsApi.list(p).then(r=>r.data), refetchInterval:15000});
export const useConversation  = (id)   => useQuery({queryKey:['conversations',id],queryFn:()=>conversationsApi.getOne(id).then(r=>r.data.data), enabled:!!id, refetchInterval:10000});

export const useAppointments     = (p={}) => useQuery({queryKey:['appointments',p], queryFn:()=>appointmentsApi.list(p).then(r=>r.data), keepPreviousData:true});
export const useSlots            = (d)    => useQuery({queryKey:['slots',d],         queryFn:()=>appointmentsApi.getSlots(d).then(r=>r.data.data), enabled:!!d});
export const useCreateAppointment= () => { const qc=useQueryClient(); return useMutation({mutationFn:d=>appointmentsApi.create(d), onSuccess:()=>{qc.invalidateQueries({queryKey:['appointments']});qc.invalidateQueries({queryKey:['analytics']});}}); };
export const useUpdateAppointment= () => { const qc=useQueryClient(); return useMutation({mutationFn:({id,data})=>appointmentsApi.update(id,data), onSuccess:()=>qc.invalidateQueries({queryKey:['appointments']})}); };
export const useSendReminder     = () => { const qc=useQueryClient(); return useMutation({mutationFn:id=>appointmentsApi.remind(id), onSuccess:()=>qc.invalidateQueries({queryKey:['appointments']})}); };

export const useClinicProfile = () => useQuery({queryKey:['clinic'], queryFn:()=>clinicApi.getProfile().then(r=>r.data.data)});
export const useUpdateClinic  = () => { const qc=useQueryClient(); return useMutation({mutationFn:d=>clinicApi.updateProfile(d), onSuccess:()=>qc.invalidateQueries({queryKey:['clinic']})}); };
