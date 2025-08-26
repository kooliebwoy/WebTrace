<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageProps } from './$types';
  import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
  import { Server, Layers, Info, XCircle, ArrowLeft } from '@lucide/svelte';
  import { fly, fade, slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';

  // Props derived from server (may not update reliably if types are broken)
  let { form }: PageProps = $props(); 
  
  // Local state for UI
  let domain = $state('');
  let isLoading = $state(false);
  let dnsRecords = $state<Array<{type: string; data: string; ttl?: number; priority?: number;}>>([]);
  let errorMessage = $state('');
  let infoMessages = $state<string[]>([]);
  let selectedRecordTypes = $state<string[]>([]);
  let showAdvancedOptions = $state(false);
  
  // Define available record types for selection
  const availableRecordTypes = [
    { id: 'A', label: 'A (IPv4)', description: 'Maps domain to IPv4 addresses' },
    { id: 'AAAA', label: 'AAAA (IPv6)', description: 'Maps domain to IPv6 addresses' },
    { id: 'CNAME', label: 'CNAME', description: 'Canonical name records (aliases)' },
    { id: 'MX', label: 'MX', description: 'Mail exchange records' },
    { id: 'NS', label: 'NS', description: 'Nameserver records' },
    { id: 'TXT', label: 'TXT', description: 'Text records' },
    { id: 'SOA', label: 'SOA', description: 'Start of authority' },
    { id: 'CAA', label: 'CAA', description: 'Certificate Authority Authorization' },
    { id: 'DMARC', label: 'DMARC', description: 'Domain-based Message Authentication' },
    { id: 'DKIM', label: 'DKIM', description: 'DomainKeys Identified Mail' },
    { id: 'SPF', label: 'SPF', description: 'Sender Policy Framework' }
  ];
  
  // Toggle record type selection
  function toggleRecordType(typeId: string) {
    if (selectedRecordTypes.includes(typeId)) {
      selectedRecordTypes = selectedRecordTypes.filter(id => id !== typeId);
    } else {
      selectedRecordTypes = [...selectedRecordTypes, typeId];
    }
  }
  
  // Selected record type for details panel
  let selectedRecordType = $state<string | null>(null);
  let showDetailsPanel = $state(false);

  // Log the form prop whenever it changes (keep for debugging)
  $effect(() => {
    console.log('[Client DNS Page] Form prop updated:', form); 
  });
  
  // Enhance callback to manage loading and manually update local state
  const handleSubmit: SubmitFunction = ({ formData }) => {
    isLoading = true;
    dnsRecords = [];
    errorMessage = '';
    
    // Reset the details panel when new results arrive
    selectedRecordType = null;
    showDetailsPanel = false;
    
    // Add selected record types to form data if any are selected
    if (selectedRecordTypes.length > 0) {
      formData.set('recordTypes', selectedRecordTypes.join(','));
    }

    return async ({ result }: { result: ActionResult }) => {
      console.log('[Client DNS Page] Enhance callback result:', result);
      isLoading = false;
      
      if (result.type === 'success' && result.data) {
        dnsRecords = result.data.records ?? [];
        infoMessages = result.data.messages ?? [];
        errorMessage = '';
      } else if (result.type === 'failure' && result.data) {
        errorMessage = result.data.error ?? 'An unknown error occurred.';
        infoMessages = [];
        dnsRecords = [];
      }
    };
  };
  
  // Handle clicking on a record type to show details
  function selectRecordType(type: string | null) {
    // If clicking the same type, toggle the panel off
    if (selectedRecordType === type) {
      selectedRecordType = null;
      showDetailsPanel = false;
      return;
    }
    
    // Otherwise, show details for the selected type
    selectedRecordType = type;
    showDetailsPanel = true;
  }
  
  // Group records by type for better organization
  function groupRecordsByType() {
    const grouped: Record<string, Array<{data: string; ttl?: number; priority?: number;}>> = {};
    
    dnsRecords.forEach(record => {
      if (!grouped[record.type]) {
        grouped[record.type] = [];
      }
      
      grouped[record.type].push({
        data: record.data,
        ttl: record.ttl,
        priority: record.priority
      });
    });
    
    return grouped;
  }
</script>

<div class="min-h-screen bg-base-200 flex flex-col items-center justify-center p-4 sm:p-6">
  <!-- Container with conditional classes for different layouts -->
  <div class="w-full max-w-[1400px] transition-all duration-500"
      class:flex={!dnsRecords.length || isLoading}
      class:flex-col={!dnsRecords.length || isLoading}
      class:items-center={!dnsRecords.length || isLoading}
      class:justify-center={!dnsRecords.length || isLoading}
      class:grid={dnsRecords.length && !isLoading}
      class:grid-cols-1={dnsRecords.length && !isLoading}
      class:md:grid-cols-2={dnsRecords.length && !isLoading && !showDetailsPanel}
      class:md:grid-cols-[minmax(350px,1fr)_minmax(400px,2fr)]={dnsRecords.length && !isLoading && !showDetailsPanel}
      class:md:grid-cols-1={dnsRecords.length && !isLoading && showDetailsPanel}
      class:lg:grid-cols-3={dnsRecords.length && !isLoading && showDetailsPanel}
      class:lg:grid-cols-[minmax(320px,1fr)_minmax(400px,2fr)_minmax(350px,1fr)]={dnsRecords.length && !isLoading && showDetailsPanel}
      class:justify-items-center={dnsRecords.length && !isLoading}
      class:gap-6={dnsRecords.length && !isLoading}
      class:lg:gap-10={dnsRecords.length && !isLoading}>
    
    <!-- Input Card - Adaptive height with mobile responsiveness -->
    <div class="card w-[min(350px,95vw)] bg-base-100 shadow-xl transition-all duration-500"
         class:self-start={dnsRecords.length && !isLoading}
         class:justify-self-center={dnsRecords.length && !isLoading}
         in:fade={{duration: 300}}>
      
      <!-- Card Header -->
      <div class="bg-secondary text-secondary-content p-5">
        <h2 class="text-2xl font-bold flex items-center gap-2">
          <Server class="h-6 w-6" />
          DNS Lookup
        </h2>
        <p class="text-sm opacity-80 mt-1">Check DNS records for any domain</p>
      </div>
      
      <!-- Card Body -->
      <div class="card-body p-6">
        <form method="post" action="?/dnsLookup" class="flex flex-col gap-4" use:enhance={handleSubmit}>
          <div class="form-control">
            <label class="label pb-1" for="dns-domain">
              <span class="label-text font-medium">Domain name</span>
            </label>
            <div class="relative">
              <input 
                type="text" 
                class="input input-bordered w-full pr-12 font-mono text-sm" 
                name="domain" 
                id="dns-domain"
                bind:value={domain} 
                placeholder="example.com" 
                required 
                minlength="4"
                disabled={isLoading} 
              />
              {#if domain}
                <button 
                  type="button" 
                  class="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle" 
                  onclick={() => domain = ''}
                  aria-label="Clear input">
                  ✕
                </button>
              {/if}
            </div>
            <p class="label pt-0">
              <span class="label-text-alt">Don't include http:// or https://</span>
            </p>
          </div>
          
          <div class="mt-2">
            <button 
              type="button" 
              class="btn btn-ghost btn-xs w-full text-left border border-base-300" 
              onclick={() => showAdvancedOptions = !showAdvancedOptions}
            >
              <span class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={showAdvancedOptions ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"} />
                </svg>
                {showAdvancedOptions ? 'Hide' : 'Show'} record type options
              </span>
            </button>
            
            {#if showAdvancedOptions}
              <div class="mt-3 bg-base-200 p-3 rounded-md">
                <p class="text-xs mb-2 opacity-70">
                  Select record types to check (default: all types)
                </p>
                
                <div class="grid grid-cols-2 gap-y-2 gap-x-4">
                  {#each availableRecordTypes as recordType}
                    <div class="flex items-center gap-2">
                      <input 
                        type="checkbox"
                        class="checkbox checkbox-xs checkbox-secondary"
                        id={`record-type-${recordType.id}`}
                        checked={selectedRecordTypes.includes(recordType.id)}
                        onchange={() => toggleRecordType(recordType.id)}
                      />
                      <label for={`record-type-${recordType.id}`} class="text-xs cursor-pointer">
                        {recordType.label}
                      </label>
                    </div>
                  {/each}
                </div>
                
                <div class="flex gap-2 mt-4">
                  <button 
                    type="button" 
                    class="btn btn-ghost btn-xs flex-1" 
                    onclick={() => selectedRecordTypes = []}
                  >
                    Clear selection
                  </button>
                  <button 
                    type="button" 
                    class="btn btn-secondary btn-xs flex-1" 
                    onclick={() => selectedRecordTypes = availableRecordTypes.map(rt => rt.id)}
                  >
                    Select all
                  </button>
                </div>
              </div>
            {/if}
          </div>
          
          <button 
            class="btn btn-secondary w-full mt-4 relative overflow-hidden" 
            type="submit" 
            disabled={isLoading}
          >
            {#if isLoading}
              <div class="absolute inset-0 flex items-center justify-center bg-secondary">
                <span class="loading loading-dots"></span>
              </div>
              <span class="opacity-0">Lookup DNS</span>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Lookup DNS
            {/if}
          </button>
          
          <div class="mt-2">
            <button 
              type="button" 
              class="btn btn-ghost btn-xs w-full flex justify-center items-center gap-2" 
              onclick={() => goto('/')}
            >
              <ArrowLeft class="w-3 h-3" /> Back to tools
            </button>
          </div>
          
          {#if errorMessage}
            <div class="alert alert-error mt-2 shadow-md" transition:slide>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 stroke-current shrink-0" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>{errorMessage}</span>
            </div>
          {/if}
        </form>
      </div>
    </div>

    {#if !isLoading && dnsRecords.length}
      <div class="flex flex-col justify-start h-full w-full max-w-[600px] mx-auto" 
           transition:fade={{duration: 300, delay: 300}}>
        
        <!-- Records Header -->
        <h3 class="text-xl font-bold mb-2 mt-2" in:fly={{y: 20, delay: 400, duration: 300}}>
          <div class="flex items-center gap-2">
            <Layers class="h-5 w-5" />
            DNS Records
          </div>
          <div class="text-sm font-normal opacity-70 mt-1">
            Domain: <span class="font-mono">{domain}</span>
          </div>
        </h3>
        
        <!-- Informational Messages -->
        {#if infoMessages.length > 0}
          <div class="alert alert-info mb-4 shadow-md" in:slide={{duration: 300, delay: 450}} out:slide>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <div class="flex flex-col gap-1">
              {#each infoMessages as message}
                <span>{message}</span>
              {/each}
            </div>
          </div>
        {/if}
        
        <!-- Records by type -->
        <div class="space-y-6">
          {#each Object.entries(groupRecordsByType()) as [type, records], i}
            <div class="relative" 
                 in:fly={{y: 40, delay: 500 + (i * 150), duration: 400, easing: quintOut}}>
              <!-- Card -->
              <div class="card bg-base-100 shadow-md rounded-lg hover:shadow-lg transition-shadow cursor-pointer"
                   role="button" tabindex="0"
                   onclick={() => selectRecordType(type)}
                   onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectRecordType(type); } }}
                   class:ring-2={selectedRecordType === type}
                   class:ring-secondary={selectedRecordType === type}
                   class:ring-offset-2={selectedRecordType === type}>
                <div class="card-body p-4">
                  <!-- Record Type -->
                  <div class="flex justify-between items-center">
                    <div class="flex items-center gap-2">
                      <span class="badge badge-secondary">{type}</span>
                      <span class="text-sm opacity-70">{records.length} record{records.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="badge badge-outline badge-sm">Click for details</div>
                  </div>
                  
                  <!-- Preview of data (first 2 records) -->
                  <div class="mt-2 space-y-2">
                    {#each records.slice(0, 2) as record}
                      <div class="font-mono text-xs bg-base-200 p-2 rounded truncate hover:text-clip">
                        {record.data}
                      </div>
                    {/each}
                    
                    {#if records.length > 2}
                      <div class="text-xs opacity-70">+ {records.length - 2} more record{records.length - 2 !== 1 ? 's' : ''}</div>
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
      
      <!-- Details Panel - slides in from right when a record type is selected -->
      {#if showDetailsPanel && selectedRecordType !== null}
        <div 
          class="h-full w-full max-w-[400px] self-start"
          in:fly={{x: 40, duration: 300}}
          out:fly={{x: 40, duration: 200}}
        >
          <div class="card bg-base-100 shadow-xl h-full sticky top-4">
            <div class="card-body p-5">
              <div class="flex justify-between items-center mb-2">
                <h3 class="card-title text-lg">
                  {selectedRecordType} Records
                </h3>
                <button class="btn btn-ghost btn-sm btn-circle" onclick={() => { selectedRecordType = null; showDetailsPanel = false; }}>
                  <XCircle class="h-5 w-5" />
                </button>
              </div>
              
              <!-- Record details -->
              <div class="py-2">
                <div class="flex items-center gap-2 mb-3">
                  <Info class="h-4 w-4" />
                  <div class="text-sm opacity-80">
                    {#if selectedRecordType === 'A'}
                      Maps a domain to IPv4 addresses
                    {:else if selectedRecordType === 'AAAA'}
                      Maps a domain to IPv6 addresses
                    {:else if selectedRecordType === 'CNAME'}
                      Maps a domain to another domain (alias)
                    {:else if selectedRecordType === 'MX'}
                      Specifies mail servers for the domain
                    {:else if selectedRecordType === 'TXT'}
                      Text records for various purposes (SPF, DKIM, etc.)
                    {:else if selectedRecordType === 'NS'}
                      Nameserver records for the domain
                    {:else}
                      {selectedRecordType} records for {domain}
                    {/if}
                  </div>
                </div>
                
                <div class="divider my-2">Details</div>
                
                <div class="overflow-y-auto max-h-[60vh] pr-2">
                  {#each groupRecordsByType()[selectedRecordType] as record, i}
                    <div class="card bg-base-200 mb-4 shadow-sm">
                      <div class="card-body p-3">
                        <div class="flex justify-between items-center">
                          <span class="badge badge-sm">Record {i + 1}</span>
                          {#if record.ttl !== undefined}
                            <span class="badge badge-sm badge-outline">TTL: {record.ttl}</span>
                          {/if}
                        </div>
                        
                        {#if record.priority !== undefined}
                          <div class="text-xs mt-1">
                            <span class="opacity-70">Priority:</span> {record.priority}
                          </div>
                        {/if}
                        
                        <div class="mt-2">
                          <div class="font-mono text-xs break-all">{record.data}</div>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>
