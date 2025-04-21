<script lang="ts">
  import { enhance } from '$app/forms';
  import { fade, fly } from 'svelte/transition';
  import { Database, ArrowLeft, Clock, Globe, Building, User, Mail, MapPin, XCircle, Check, Copy, FileText } from '@lucide/svelte';
  import type { ActionData, PageData } from './$types';
  import { goto } from '$app/navigation';
  
  export let data: PageData;
  export let form: ActionData;
  
  let domain = '';
  let isLoading = false;
  let showCopiedToast = false;
  let selectedTab = 'overview';
  
  $: whoisData = form?.whoisData;
  $: error = form?.error;
  
  function handleSubmit({ form, data, action, cancel, submitter }) {
    isLoading = true;
    
    return async ({ result, update }) => {
      isLoading = false;
      await update();
    };
  }
  
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    showCopiedToast = true;
    setTimeout(() => showCopiedToast = false, 2000);
  }
  
  function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    return dateStr;
  }
  
  function getRemainingDays(expiryDate) {
    if (!expiryDate || expiryDate === 'N/A') return null;
    
    try {
      const expiry = new Date(expiryDate);
      const now = new Date();
      const diffTime = expiry.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    } catch (e) {
      return null;
    }
  }
  
  $: remainingDays = whoisData ? getRemainingDays(whoisData.expiresDate) : null;
  
  function getExpiryStatusClass(days) {
    if (days === null) return 'badge-outline';
    if (days <= 0) return 'badge-error';
    if (days <= 30) return 'badge-warning';
    return 'badge-success';
  }
  
  function getExpiryStatusText(days) {
    if (days === null) return 'Unknown';
    if (days <= 0) return 'Expired';
    if (days <= 30) return `Expires soon (${days} days)`;
    return `${days} days`;
  }
</script>

<div class="min-h-screen bg-base-200 flex flex-col items-center justify-center p-4 sm:p-6">
  <!-- Container with conditional classes for different layouts -->
  <div class="w-full max-w-[1400px] transition-all duration-500"
      class:flex={!whoisData || isLoading}
      class:flex-col={!whoisData || isLoading}
      class:items-center={!whoisData || isLoading}
      class:justify-center={!whoisData || isLoading}
      class:grid={whoisData && !isLoading}
      class:grid-cols-1={whoisData && !isLoading}
      class:lg:grid-cols-2={whoisData && !isLoading}
      class:lg:grid-cols-[minmax(350px,1fr)_minmax(500px,2fr)]={whoisData && !isLoading}
      class:gap-6={whoisData && !isLoading}
      class:lg:gap-10={whoisData && !isLoading}>
    
    <!-- Input Card -->
    <div class="card w-[min(350px,95vw)] bg-base-100 shadow-xl transition-all duration-500"
         class:self-start={whoisData && !isLoading}
         class:justify-self-center={whoisData && !isLoading}
         in:fade={{duration: 300}}>
      
      <!-- Card Header -->
      <div class="bg-info text-info-content p-5">
        <h2 class="text-2xl font-bold flex items-center gap-2">
          <Database class="h-6 w-6" />
          WHOIS Lookup
        </h2>
        <p class="text-sm opacity-80 mt-1">Check domain registration details</p>
      </div>
      
      <!-- Card Body -->
      <div class="card-body p-6">
        <form method="post" action="?/whoisLookup" class="flex flex-col gap-4" use:enhance={handleSubmit}>
          <div class="form-control">
            <label class="label pb-1">
              <span class="label-text font-medium">Domain name</span>
            </label>
            <div class="relative">
              <input 
                type="text" 
                class="input input-bordered w-full pr-12 font-mono text-sm" 
                name="domain" 
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
            <label class="label pt-0">
              <span class="label-text-alt">Don't include http:// or https://</span>
            </label>
          </div>
          
          <button 
            class="btn btn-info w-full mt-4 relative overflow-hidden" 
            type="submit" 
            disabled={isLoading}
          >
            {#if isLoading}
              <span class="loading loading-spinner loading-sm absolute"></span>
              <span class="opacity-0">Lookup WHOIS</span>
            {:else}
              <Database class="w-4 h-4 mr-2" />
              Lookup WHOIS
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
        </form>
      </div>
    </div>
    
    <!-- Results Card -->
    {#if whoisData && !isLoading}
      <div class="card w-full bg-base-100 shadow-xl self-start overflow-hidden" in:fly={{x: 20, duration: 300, delay: 150}}>
        <div class="bg-base-200 p-4 border-b border-base-300 flex justify-between items-center">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <Database class="w-5 h-5" />
            {form.domain}
          </h3>
          
          <div class="flex gap-2">
            <button 
              class="btn btn-xs btn-ghost"
              onclick={() => copyToClipboard(JSON.stringify(whoisData, null, 2))}
            >
              <Copy class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        
        <!-- Tab Navigation -->
        <div class="tabs tabs-boxed bg-base-100 rounded-none px-4 pt-4">
          <button 
            class={`tab ${selectedTab === 'overview' ? 'tab-active' : ''}`}
            onclick={() => selectedTab = 'overview'}
          >
            Overview
          </button>
          <button 
            class={`tab ${selectedTab === 'contacts' ? 'tab-active' : ''}`}
            onclick={() => selectedTab = 'contacts'}
          >
            Contacts
          </button>
          <button 
            class={`tab ${selectedTab === 'nameservers' ? 'tab-active' : ''}`}
            onclick={() => selectedTab = 'nameservers'}
          >
            Name Servers
          </button>
          <button 
            class={`tab ${selectedTab === 'raw' ? 'tab-active' : ''}`}
            onclick={() => selectedTab = 'raw'}
          >
            Raw Data
          </button>
        </div>
        
        <div class="p-6">
          {#if selectedTab === 'overview'}
            <!-- Overview Tab -->
            <div class="space-y-5">
              <!-- Domain Details -->
              <div>
                <h4 class="text-sm font-semibold mb-3 text-base-content/70 uppercase">Domain Information</h4>
                
                <div class="grid gap-4 sm:grid-cols-2">
                  <!-- Domain Registration Status -->
                  <div class="bg-base-200 p-3 rounded-lg">
                    <div class="text-xs text-base-content/60 mb-1">Status</div>
                    <div class="font-mono text-sm break-all">
                      {whoisData.status || 'Unknown'}
                    </div>
                  </div>
                  
                  <!-- Registrar -->
                  <div class="bg-base-200 p-3 rounded-lg">
                    <div class="text-xs text-base-content/60 mb-1">Registrar</div>
                    <div class="font-mono text-sm break-all">
                      {whoisData.registrar || 'Unknown'}
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Dates -->
              <div>
                <h4 class="text-sm font-semibold mb-3 text-base-content/70 uppercase">Important Dates</h4>
                
                <div class="grid gap-4 sm:grid-cols-3">
                  <!-- Creation Date -->
                  <div class="bg-base-200 p-3 rounded-lg flex items-start gap-2">
                    <Clock class="w-4 h-4 text-base-content/60 mt-0.5" />
                    <div>
                      <div class="text-xs text-base-content/60 mb-1">Created</div>
                      <div class="text-sm">{formatDate(whoisData.createdDate)}</div>
                    </div>
                  </div>
                  
                  <!-- Updated Date -->
                  <div class="bg-base-200 p-3 rounded-lg flex items-start gap-2">
                    <Clock class="w-4 h-4 text-base-content/60 mt-0.5" />
                    <div>
                      <div class="text-xs text-base-content/60 mb-1">Updated</div>
                      <div class="text-sm">{formatDate(whoisData.updatedDate)}</div>
                    </div>
                  </div>
                  
                  <!-- Expiration Date -->
                  <div class="bg-base-200 p-3 rounded-lg flex items-start gap-2">
                    <Clock class="w-4 h-4 text-base-content/60 mt-0.5" />
                    <div>
                      <div class="text-xs text-base-content/60 mb-1">Expires</div>
                      <div class="flex items-center gap-2">
                        <span class="text-sm">{formatDate(whoisData.expiresDate)}</span>
                        {#if remainingDays !== null}
                          <span class={`badge ${getExpiryStatusClass(remainingDays)}`}>
                            {getExpiryStatusText(remainingDays)}
                          </span>
                        {/if}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Registrant Info Preview -->
              <div>
                <h4 class="text-sm font-semibold mb-3 text-base-content/70 uppercase">Registrant</h4>
                
                <div class="bg-base-200 p-3 rounded-lg">
                  <div class="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div class="flex-1">
                      <div class="text-xs text-base-content/60 mb-1">Organization</div>
                      <div class="font-medium">
                        {whoisData.registrant?.organization || 'Private'}
                      </div>
                    </div>
                    
                    {#if whoisData.registrant?.country}
                      <div>
                        <div class="text-xs text-base-content/60 mb-1">Country</div>
                        <div class="flex items-center gap-1">
                          <MapPin class="w-3.5 h-3.5" />
                          <span>{whoisData.registrant.country}</span>
                        </div>
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          {:else if selectedTab === 'contacts'}
            <!-- Contacts Tab -->
            <div class="space-y-5">
              <!-- Registrant -->
              <div>
                <h4 class="text-sm font-semibold mb-3 text-base-content/70 uppercase flex items-center gap-2">
                  <User class="w-4 h-4" />
                  Registrant
                </h4>
                
                <div class="bg-base-200 p-4 rounded-lg">
                  <div class="grid gap-4 sm:grid-cols-2">
                    <div>
                      <div class="text-xs text-base-content/60 mb-1">Name</div>
                      <div>{whoisData.registrant?.name || 'Private'}</div>
                    </div>
                    <div>
                      <div class="text-xs text-base-content/60 mb-1">Organization</div>
                      <div>{whoisData.registrant?.organization || 'Private'}</div>
                    </div>
                    <div>
                      <div class="text-xs text-base-content/60 mb-1">Email</div>
                      <div class="flex items-center gap-2">
                        <Mail class="w-3.5 h-3.5" />
                        <span>{whoisData.registrant?.email || 'Private'}</span>
                      </div>
                    </div>
                    <div>
                      <div class="text-xs text-base-content/60 mb-1">Country</div>
                      <div class="flex items-center gap-2">
                        <MapPin class="w-3.5 h-3.5" />
                        <span>{whoisData.registrant?.country || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Administrative Contact -->
              <div>
                <h4 class="text-sm font-semibold mb-3 text-base-content/70 uppercase flex items-center gap-2">
                  <Building class="w-4 h-4" />
                  Administrative Contact
                </h4>
                
                <div class="bg-base-200 p-4 rounded-lg">
                  <div class="grid gap-4 sm:grid-cols-2">
                    <div>
                      <div class="text-xs text-base-content/60 mb-1">Name</div>
                      <div>{whoisData.administrative?.name || 'Private'}</div>
                    </div>
                    <div>
                      <div class="text-xs text-base-content/60 mb-1">Organization</div>
                      <div>{whoisData.administrative?.organization || 'Private'}</div>
                    </div>
                    <div>
                      <div class="text-xs text-base-content/60 mb-1">Email</div>
                      <div class="flex items-center gap-2">
                        <Mail class="w-3.5 h-3.5" />
                        <span>{whoisData.administrative?.email || 'Private'}</span>
                      </div>
                    </div>
                    <div>
                      <div class="text-xs text-base-content/60 mb-1">Country</div>
                      <div class="flex items-center gap-2">
                        <MapPin class="w-3.5 h-3.5" />
                        <span>{whoisData.administrative?.country || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Technical Contact -->
              <div>
                <h4 class="text-sm font-semibold mb-3 text-base-content/70 uppercase flex items-center gap-2">
                  <Globe class="w-4 h-4" />
                  Technical Contact
                </h4>
                
                <div class="bg-base-200 p-4 rounded-lg">
                  <div class="grid gap-4 sm:grid-cols-2">
                    <div>
                      <div class="text-xs text-base-content/60 mb-1">Name</div>
                      <div>{whoisData.technical?.name || 'Private'}</div>
                    </div>
                    <div>
                      <div class="text-xs text-base-content/60 mb-1">Organization</div>
                      <div>{whoisData.technical?.organization || 'Private'}</div>
                    </div>
                    <div>
                      <div class="text-xs text-base-content/60 mb-1">Email</div>
                      <div class="flex items-center gap-2">
                        <Mail class="w-3.5 h-3.5" />
                        <span>{whoisData.technical?.email || 'Private'}</span>
                      </div>
                    </div>
                    <div>
                      <div class="text-xs text-base-content/60 mb-1">Country</div>
                      <div class="flex items-center gap-2">
                        <MapPin class="w-3.5 h-3.5" />
                        <span>{whoisData.technical?.country || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          {:else if selectedTab === 'nameservers'}
            <!-- Name Servers Tab -->
            <div>
              <h4 class="text-sm font-semibold mb-3 text-base-content/70 uppercase">Name Servers</h4>
              
              {#if whoisData.nameServers && whoisData.nameServers.length > 0}
                <div class="bg-base-200 p-4 rounded-lg">
                  <ul class="space-y-2">
                    {#each whoisData.nameServers as server}
                      <li class="font-mono text-sm">{server}</li>
                    {/each}
                  </ul>
                </div>
              {:else}
                <div class="alert">
                  <span>No name server information available</span>
                </div>
              {/if}
            </div>
          {:else if selectedTab === 'raw'}
            <!-- Raw Data Tab -->
            <div>
              <div class="flex justify-between items-center mb-3">
                <h4 class="text-sm font-semibold text-base-content/70 uppercase">Raw WHOIS Data</h4>
                <button 
                  class="btn btn-xs btn-ghost"
                  onclick={() => copyToClipboard(JSON.stringify(whoisData.raw, null, 2))}
                >
                  <Copy class="w-3.5 h-3.5 mr-1" />
                  Copy
                </button>
              </div>
              
              <div class="bg-base-200 p-4 rounded-lg">
                <pre class="text-xs overflow-x-auto max-h-[400px]">{JSON.stringify(whoisData.raw, null, 2)}</pre>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {:else if error && !isLoading}
      <div class="alert alert-error mt-4 w-full max-w-md" in:fly={{y: 20, duration: 300}}>
        <XCircle class="w-5 h-5" />
        <span>{error}</span>
      </div>
    {/if}
  </div>
</div>

<!-- Toast for copy notification -->
{#if showCopiedToast}
  <div class="toast toast-top toast-center" transition:fade>
    <div class="alert alert-success">
      <Check class="w-4 h-4" />
      <span>Copied to clipboard!</span>
    </div>
  </div>
{/if}
