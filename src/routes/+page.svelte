<script lang="ts">
  import { ArrowRight, Server, Repeat2, Lock, Database, Globe, Mail, Globe2 } from '@lucide/svelte';
  import { fade, fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  

  // Array of available tools
  const availableTools = [
    {
      name: 'Redirect Checker',
      description: 'Track the redirection path of any domain or URL',
      icon: Repeat2,
      color: 'bg-primary-soft',
      textColor: 'text-primary',
      route: '/redirect',
      available: true
    },
    {
      name: 'DNS Lookup',
      description: 'Check DNS records for any domain',
      icon: Server,
      color: 'bg-secondary-soft',
      textColor: 'text-secondary',
      route: '/dns',
      available: true
    },
    {
      name: 'SSL Certificate',
      description: 'Verify and inspect SSL certificates',
      icon: Lock,
      color: 'bg-success-soft',
      textColor: 'text-success',
      route: '/ssl',
      available: true
    },
    {
      name: 'WHOIS Lookup',
      description: 'Lookup domain registration details',
      icon: Database,
      color: 'bg-info-soft',
      textColor: 'text-info',
      route: '/whois',
      available: true
    },
    {
      name: 'HTTP Headers',
      description: 'Analyze HTTP response headers',
      icon: Globe,
      color: 'bg-success-soft',
      textColor: 'text-success',
      route: '/headers',
      available: true
    },
    {
      name: 'SPF Validator',
      description: 'Validate SPF records for email domains',
      icon: Mail,
      color: 'bg-warning-soft',
      textColor: 'text-warning',
      route: '/spf',
      available: true
    },
    // {
    //   name: 'DNS Propagation',
    //   description: 'Check DNS record propagation across global servers',
    //   icon: Globe2,
    //   color: 'bg-accent-soft',
    //   textColor: 'text-accent',
    //   route: '/propagation',
    //   available: false // Hide temporarily until fixed
    // }
  ];
</script>

<svelte:head>
  <title>RouteKit - Network Diagnostic Toolkit</title>
</svelte:head>

<div class="min-h-screen bg-base-200 flex flex-col items-center p-4 sm:p-6">
  <div class="w-full max-w-[1200px] transition-all duration-500">
    <!-- Header -->
    <div class="text-center mb-12" in:fade={{duration: 400}}>
      <h1 class="text-4xl font-bold mb-2">RouteKit</h1>
      <p class="text-lg opacity-80">A collection of network and web tools</p>
    </div>
    
    
    <!-- Tools Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
      {#each availableTools as tool, i}
        <div 
          class="card bg-base-100 shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
          in:fly={{y: 20, delay: 100 + (i * 75), duration: 400, easing: quintOut}}
        >
          <!-- Card Header -->
          <div class="{tool.color} p-5">
            <h2 class="text-2xl font-bold flex items-center gap-2 {tool.textColor}">
              <svelte:component this={tool.icon} class="h-6 w-6" />
              {tool.name}
            </h2>
            <p class="text-sm opacity-80 mt-1 text-base-content">{tool.description}</p>
          </div>
          
          <!-- Card Body -->
          <div class="card-body p-5">
            {#if tool.available}
              <a 
                href={tool.route} 
                class="btn w-full btn-outline {tool.textColor.replace('text-', 'btn-')}"
              >
                <span>Open Tool</span>
                <ArrowRight class="h-4 w-4 ml-1" />
              </a>
            {:else}
              <button class="btn w-full btn-disabled" disabled>
                <span>Coming Soon</span>
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>