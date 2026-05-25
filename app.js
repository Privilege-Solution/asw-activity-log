$(document).ready(function() {
  // --- Application State ---
  const state = {
    lang: localStorage.getItem('property_lang') || 'th',
    currentUser: JSON.parse(sessionStorage.getItem('property_user')) || null,
    currentRoute: '',
    selectedAgencyId: null,
    tempAttachments: []
  };

  // --- Initialize App ---
  function init() {
    // Check if we are viewing a shared request directly
    const urlParams = new URLSearchParams(window.location.search);
    const viewId = urlParams.get('view_id');

    if (viewId) {
      state.currentRoute = 'public-view';
      showPublicRequest(viewId);
    } else {
      setupRouting();
    }

    applyLanguage(state.lang);
    bindEvents();
  }

  // --- Translation Engine ---
  function applyLanguage(lang) {
    state.lang = lang;
    localStorage.setItem('property_lang', lang);

    // Update lang button text
    $('.toggle-lang').each(function() {
      const btnLang = $(this).attr('data-lang');
      if (lang === 'en') {
        $(this).text('ภาษาไทย').attr('data-lang', 'th');
      } else {
        $(this).text('English').attr('data-lang', 'en');
      }
    });

    // Translate attributes
    $('[data-i18n]').each(function() {
      const key = $(this).attr('data-i18n');
      if (i18n[lang][key]) {
        $(this).text(i18n[lang][key]);
      }
    });

    // Translate Placeholders
    $('[placeholder]').each(function() {
      const placeholderKey = $(this).attr('id');
      if (placeholderKey && i18n[lang][placeholderKey + '_placeholder']) {
        $(this).attr('placeholder', i18n[lang][placeholderKey + '_placeholder']);
      }
    });

    // Re-render components with localized data
    if (state.currentUser) {
      renderCurrentPage();
    } else if (state.currentRoute === 'public-view') {
      const urlParams = new URLSearchParams(window.location.search);
      showPublicRequest(urlParams.get('view_id'));
    }
  }

  // --- SPA Routing Manager ---
  function setupRouting() {
    // Check if logged in
    if (!state.currentUser) {
      window.location.hash = '#login';
      showLoginView();
      return;
    }

    // Hash change handler
    $(window).on('hashchange', handleHashChange);
    
    // Trigger initial hash check
    handleHashChange();
  }

  function handleHashChange() {
    if (!state.currentUser) {
      window.location.hash = '#login';
      showLoginView();
      return;
    }

    const hash = window.location.hash || (state.currentUser.role === 'sale' ? '#sale-overview' : '#agency-requests');
    state.currentRoute = hash;

    // Remove active state from sidebars
    $('.sidebar-menu li').removeClass('active');

    if (state.currentUser.role === 'sale') {
      showSaleLayout();
      // Route specific sale pages
      $('.sale-page').hide();
      if (hash === '#sale-overview') {
        $('[data-page="sale-overview"]').addClass('active');
        $('#sale-overview-page').show();
        renderSaleDashboard();
      } else if (hash === '#sale-agencies') {
        $('[data-page="sale-agencies"]').addClass('active');
        $('#sale-agencies-page').show();
        renderAgencies();
      } else if (hash === '#sale-requests') {
        $('[data-page="sale-requests"]').addClass('active');
        $('#sale-requests-page').show();
        renderRequests();
      } else {
        // Default to dashboard
        window.location.hash = '#sale-overview';
      }
    } else if (state.currentUser.role === 'agency') {
      showAgencyLayout();
      // Route specific agency pages
      $('.agency-page').hide();
      if (hash === '#agency-requests') {
        $('[data-page="agency-requests"]').addClass('active');
        $('#agency-requests-page').show();
        renderAgencyRequests();
      } else if (hash === '#agency-members') {
        $('[data-page="agency-members"]').addClass('active');
        $('#agency-members-page').show();
        renderAgencyMembers();
      } else {
        window.location.hash = '#agency-requests';
      }
    }
  }

  function renderCurrentPage() {
    handleHashChange();
  }

  // --- Views Visibility Toggles ---
  function showLoginView() {
    $('#view-sale-layout').hide();
    $('#view-agency-layout').hide();
    $('#view-public-request').hide();
    $('#view-login').show();
    $('#login-error').hide();
    $('#username').val('');
    $('#password').val('');
  }

  function showSaleLayout() {
    $('#view-login').hide();
    $('#view-agency-layout').hide();
    $('#view-public-request').hide();
    $('#view-sale-layout').show();

    // Set sales info
    $('#sale-user-name').text(state.currentUser.name);
    $('#sale-user-avatar').text(state.currentUser.name.charAt(0));
  }

  function showAgencyLayout() {
    $('#view-login').hide();
    $('#view-sale-layout').hide();
    $('#view-public-request').hide();
    $('#view-agency-layout').show();

    // Set agency info
    const agency = db.getAgency(state.currentUser.agencyId);
    const displayAgencyName = agency ? agency.name : 'Agency';
    $('#agency-user-name').text(state.currentUser.name);
    $('#agency-user-avatar').text(state.currentUser.name.charAt(0));
    $('#agency-footer-name').text(displayAgencyName);

    // Update notification bell badge count on load
    updateNotificationBell();
  }

  // --- Toast Alerts ---
  function showToast(messageKey, isSuccess = true) {
    const message = i18n[state.lang][messageKey] || messageKey;
    $('#toast-text').text(message);
    
    if (isSuccess) {
      $('#toast i').attr('class', 'fa-solid fa-circle-check').css('color', '#10b981');
    } else {
      $('#toast i').attr('class', 'fa-solid fa-triangle-exclamation').css('color', '#ef4444');
    }
    
    $('#toast').fadeIn().css('display', 'flex');
    setTimeout(() => {
      $('#toast').fadeOut();
    }, 3000);
  }

  // --- Sales Dashboard Render ---
  function renderSaleDashboard() {
    const requests = db.getRequests();
    
    // Count stats
    const total = requests.length;
    const process = requests.filter(r => r.status === 'In process').length;
    const pending = requests.filter(r => r.status === 'Pending').length;
    const done = requests.filter(r => r.status === 'Done').length;

    $('#sale-stat-total').text(total);
    $('#sale-stat-process').text(process);
    $('#sale-stat-pending').text(pending);
    $('#sale-stat-done').text(done);

    // Recent Requests (last 5)
    const recent = requests.slice(0, 5);
    const tbody = $('#sale-recent-requests-tbody');
    tbody.empty();

    if (recent.length === 0) {
      tbody.append(`<tr><td colspan="6" style="text-align:center;" data-i18n="no_data">${i18n[state.lang].no_data}</td></tr>`);
      return;
    }

    recent.forEach(req => {
      const project = db.getProject(req.projectId);
      const projectName = project ? (state.lang === 'th' ? project.name_th : project.name_en) : '';
      const agency = db.getAgency(req.agencyId);
      const agent = db.getAgent(req.agentId);
      
      let assignText = agency ? agency.name : '';
      if (agent) assignText += ` (${agent.name})`;

      const statusBadgeClass = req.status === 'In process' ? 'badge-process' : (req.status === 'Pending' ? 'badge-pending' : 'badge-done');
      const statusText = req.status === 'In process' ? i18n[state.lang].status_in_process : (req.status === 'Pending' ? i18n[state.lang].status_pending : i18n[state.lang].status_done);

      tbody.append(`
        <tr>
          <td>${req.date}</td>
          <td><strong>${i18n[state.lang][req.type] || req.type}</strong></td>
          <td>${projectName}</td>
          <td>${assignText}</td>
          <td><span class="badge ${statusBadgeClass}">${statusText}</span></td>
          <td>
            <div class="action-group">
              <button class="action-btn share-request-btn" data-id="${req.id}" title="${i18n[state.lang].share}"><i class="fa-solid fa-share-nodes"></i></button>
              <button class="action-btn edit-request-btn" data-id="${req.id}" title="${i18n[state.lang].edit}"><i class="fa-solid fa-pen-to-square"></i></button>
              <button class="action-btn delete-btn delete-request-btn" data-id="${req.id}" title="${i18n[state.lang].delete}"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </td>
        </tr>
      `);
    });
  }

  // --- Agencies Directory Render ---
  function renderAgencies() {
    const agencies = db.getAgencies();
    const searchValue = $('#agency-search-input').val().toLowerCase();
    const tbody = $('#agencies-tbody');
    tbody.empty();

    const filtered = agencies.filter(a => 
      a.name.toLowerCase().includes(searchValue) ||
      a.phone.toLowerCase().includes(searchValue) ||
      a.email.toLowerCase().includes(searchValue)
    );

    if (filtered.length === 0) {
      tbody.append(`<tr><td colspan="5" style="text-align:center;" data-i18n="no_data">${i18n[state.lang].no_data}</td></tr>`);
      return;
    }

    filtered.forEach(agency => {
      tbody.append(`
        <tr>
          <td><strong>${agency.name}</strong></td>
          <td>${agency.phone}</td>
          <td>${agency.email}</td>
          <td>${agency.address}</td>
          <td>
            <div class="action-group">
              <button class="btn btn-secondary btn-sm btn-view-agents" data-id="${agency.id}"><i class="fa-solid fa-users"></i> ${i18n[state.lang].view_agents}</button>
              <button class="action-btn edit-agency-btn" data-id="${agency.id}"><i class="fa-solid fa-pen-to-square"></i></button>
              <button class="action-btn delete-btn delete-agency-btn" data-id="${agency.id}"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </td>
        </tr>
      `);
    });
  }

  // --- Agency Subview: Agents Render ---
  function renderAgents() {
    const agency = db.getAgency(state.selectedAgencyId);
    if (!agency) return;

    $('#subview-agency-title').text(agency.name);
    $('#subview-agency-contact-info').text(`${agency.phone} | ${agency.email}`);

    const agents = db.getAgents(state.selectedAgencyId);
    const tbody = $('#agents-tbody');
    tbody.empty();

    if (agents.length === 0) {
      tbody.append(`<tr><td colspan="5" style="text-align:center;" data-i18n="no_data">${i18n[state.lang].no_data}</td></tr>`);
      return;
    }

    agents.forEach(agent => {
      const statusBadge = agent.active ? 'badge-done' : 'badge-process';
      const statusText = agent.active ? i18n[state.lang].active : i18n[state.lang].inactive;

      tbody.append(`
        <tr>
          <td><strong>${agent.name}</strong></td>
          <td>${agent.phone}</td>
          <td>${agent.email}</td>
          <td><span class="badge ${statusBadge}">${statusText}</span></td>
          <td>
            <div class="action-group">
              <button class="action-btn edit-agent-btn" data-id="${agent.id}"><i class="fa-solid fa-pen-to-square"></i></button>
              <button class="action-btn delete-btn delete-agent-btn" data-id="${agent.id}"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </td>
        </tr>
      `);
    });
  }

  // --- Requests Page Render ---
  function renderRequests() {
    const requests = db.getRequests();
    const searchValue = $('#request-search-input').val().toLowerCase();
    const filterType = $('#filter-activity-type').val();
    const filterStatus = $('#filter-status').val();
    const tbody = $('#requests-tbody');
    tbody.empty();

    let filtered = requests.filter(r => {
      const project = db.getProject(r.projectId);
      const projectName = project ? (state.lang === 'th' ? project.name_th : project.name_en) : '';
      const agency = db.getAgency(r.agencyId);
      const agencyName = agency ? agency.name : '';
      
      const matchSearch = 
        projectName.toLowerCase().includes(searchValue) ||
        agencyName.toLowerCase().includes(searchValue) ||
        r.details.toLowerCase().includes(searchValue) ||
        r.id.toLowerCase().includes(searchValue);
      
      const matchType = filterType ? r.type === filterType : true;
      const matchStatus = filterStatus ? r.status === filterStatus : true;

      return matchSearch && matchType && matchStatus;
    });

    if (filtered.length === 0) {
      tbody.append(`<tr><td colspan="6" style="text-align:center;" data-i18n="no_data">${i18n[state.lang].no_data}</td></tr>`);
      return;
    }

    filtered.forEach(req => {
      const project = db.getProject(req.projectId);
      const projectName = project ? (state.lang === 'th' ? project.name_th : project.name_en) : '';
      const agency = db.getAgency(req.agencyId);
      const agent = db.getAgent(req.agentId);
      
      let assignText = agency ? agency.name : '';
      if (agent) assignText += ` (${agent.name})`;

      const statusBadgeClass = req.status === 'In process' ? 'badge-process' : (req.status === 'Pending' ? 'badge-pending' : 'badge-done');
      const statusText = req.status === 'In process' ? i18n[state.lang].status_in_process : (req.status === 'Pending' ? i18n[state.lang].status_pending : i18n[state.lang].status_done);

      tbody.append(`
        <tr>
          <td>${req.date}</td>
          <td><strong>${i18n[state.lang][req.type] || req.type}</strong></td>
          <td>${projectName}</td>
          <td>${assignText}</td>
          <td><span class="badge ${statusBadgeClass}">${statusText}</span></td>
          <td>
            <div class="action-group">
              <button class="action-btn share-request-btn" data-id="${req.id}" title="${i18n[state.lang].share}"><i class="fa-solid fa-share-nodes"></i></button>
              <button class="action-btn edit-request-btn" data-id="${req.id}" title="${i18n[state.lang].edit}"><i class="fa-solid fa-pen-to-square"></i></button>
              <button class="action-btn delete-btn delete-request-btn" data-id="${req.id}" title="${i18n[state.lang].delete}"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </td>
        </tr>
      `);
    });
  }

  // --- Agency Portal: Incoming Requests Render ---
  function renderAgencyRequests() {
    const currentAgencyId = state.currentUser.agencyId;
    const searchValue = $('#agency-request-search').val().toLowerCase();
    const filterStatus = $('#agency-filter-status').val();
    const requests = db.getRequests({ agencyId: currentAgencyId });
    const tbody = $('#agency-requests-tbody');
    tbody.empty();

    let filtered = requests.filter(r => {
      const project = db.getProject(r.projectId);
      const projectName = project ? (state.lang === 'th' ? project.name_th : project.name_en) : '';
      const agent = db.getAgent(r.agentId);
      const agentName = agent ? agent.name : '';

      const matchSearch = 
        projectName.toLowerCase().includes(searchValue) ||
        agentName.toLowerCase().includes(searchValue) ||
        r.details.toLowerCase().includes(searchValue) ||
        r.id.toLowerCase().includes(searchValue);
      
      const matchStatus = filterStatus ? r.status === filterStatus : true;

      return matchSearch && matchStatus;
    });

    if (filtered.length === 0) {
      tbody.append(`<tr><td colspan="7" style="text-align:center;" data-i18n="no_data">${i18n[state.lang].no_data}</td></tr>`);
      return;
    }

    filtered.forEach(req => {
      const project = db.getProject(req.projectId);
      const projectName = project ? (state.lang === 'th' ? project.name_th : project.name_en) : '';
      const agent = db.getAgent(req.agentId);
      const agentName = agent ? agent.name : '-';

      const statusBadgeClass = req.status === 'In process' ? 'badge-process' : (req.status === 'Pending' ? 'badge-pending' : 'badge-done');
      const statusText = req.status === 'In process' ? i18n[state.lang].status_in_process : (req.status === 'Pending' ? i18n[state.lang].status_pending : i18n[state.lang].status_done);

      tbody.append(`
        <tr>
          <td>${req.date}</td>
          <td><strong>${i18n[state.lang][req.type] || req.type}</strong></td>
          <td>${projectName}</td>
          <td>${req.salesName}</td>
          <td>${agentName}</td>
          <td><span class="badge ${statusBadgeClass}">${statusText}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm view-agency-details-btn" data-id="${req.id}">
              <i class="fa-solid fa-eye"></i> ${i18n[state.lang].details}
            </button>
          </td>
        </tr>
      `);
    });

    // Update notification bell badge count when requests are re-rendered/updated
    updateNotificationBell();
  }

  // --- Agency Portal: Members List Render ---
  function renderAgencyMembers() {
    const currentAgencyId = state.currentUser.agencyId;
    const agents = db.getAgents(currentAgencyId);
    const tbody = $('#agency-members-tbody');
    tbody.empty();

    if (agents.length === 0) {
      tbody.append(`<tr><td colspan="5" style="text-align:center;" data-i18n="no_data">${i18n[state.lang].no_data}</td></tr>`);
      return;
    }

    agents.forEach(agent => {
      const statusBadge = agent.active ? 'badge-done' : 'badge-process';
      const statusText = agent.active ? i18n[state.lang].active : i18n[state.lang].inactive;

      tbody.append(`
        <tr>
          <td><strong>${agent.name}</strong></td>
          <td>${agent.phone}</td>
          <td>${agent.email}</td>
          <td><span class="badge ${statusBadge}">${statusText}</span></td>
          <td>
            <div class="action-group">
              <button class="action-btn edit-member-btn" data-id="${agent.id}"><i class="fa-solid fa-pen-to-square"></i></button>
              <button class="action-btn delete-btn delete-member-btn" data-id="${agent.id}"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </td>
        </tr>
      `);
    });
  }

  // --- Direct Document Link View (Public Screen) ---
  function showPublicRequest(id) {
    $('#app-shell > div').hide();
    $('#view-public-request').show();

    const req = db.getRequest(id);
    const contentBox = $('#public-content-box');
    contentBox.empty();

    if (!req) {
      contentBox.append(`
        <div style="text-align:center; padding: 40px 0; color: #e11d48;">
          <i class="fa-solid fa-circle-exclamation" style="font-size: 48px; margin-bottom: 16px;"></i>
          <h4 data-i18n="invalid_request" style="color: #e11d48;">${i18n[state.lang].invalid_request}</h4>
        </div>
      `);
      return;
    }

    const project = db.getProject(req.projectId);
    const projectName = project ? (state.lang === 'th' ? project.name_th : project.name_en) : '';
    const agency = db.getAgency(req.agencyId);
    const agent = db.getAgent(req.agentId);
    let assignText = agency ? agency.name : '';
    if (agent) assignText += ` (${agent.name})`;

    const statusBadgeClass = req.status === 'In process' ? 'badge-process' : (req.status === 'Pending' ? 'badge-pending' : 'badge-done');
    const statusText = req.status === 'In process' ? i18n[state.lang].status_in_process : (req.status === 'Pending' ? i18n[state.lang].status_pending : i18n[state.lang].status_done);

    let attachmentHtml = '';
    const attachmentsList = req.attachments || (req.attachment ? [req.attachment] : []);
    if (attachmentsList.length > 0) {
      attachmentHtml = `
        <div class="public-attachment-section mt-4">
          <label data-i18n="attachment">${i18n[state.lang].attachment}</label>
          <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
            ${attachmentsList.map(att => `
              <div class="public-download-card">
                <i class="fa-solid fa-file-pdf"></i>
                <div class="public-download-info">
                  <h4>${att.name}</h4>
                  <p>${att.size}</p>
                </div>
                <button class="btn btn-primary btn-sm simulate-download-btn" data-filename="${att.name}">
                  <i class="fa-solid fa-download"></i> <span data-i18n="download">${i18n[state.lang].download}</span>
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    contentBox.append(`
      <div class="public-detail-grid">
        <div class="public-detail-item">
          <label data-i18n="created_date">${i18n[state.lang].created_date}</label>
          <span>${req.date}</span>
        </div>
        <div class="public-detail-item">
          <label data-i18n="status">${i18n[state.lang].status}</label>
          <span><span class="badge ${statusBadgeClass}">${statusText}</span></span>
        </div>
        <div class="public-detail-item">
          <label data-i18n="act_type">${i18n[state.lang].act_type}</label>
          <span><strong>${i18n[state.lang][req.type] || req.type}</strong></span>
        </div>
        <div class="public-detail-item">
          <label data-i18n="project">${i18n[state.lang].project}</label>
          <span>${projectName}</span>
        </div>
        <div class="public-detail-item">
          <label data-i18n="sender">${i18n[state.lang].sender}</label>
          <span>${req.salesName}</span>
        </div>
        <div class="public-detail-item">
          <label data-i18n="agent_agency">${i18n[state.lang].agent_agency}</label>
          <span>${assignText}</span>
        </div>
      </div>

      <div class="public-description">
        <label data-i18n="details" style="font-weight:600; display:block; margin-bottom:8px; font-size:13px; color:var(--text-light); text-transform:uppercase;">
          ${i18n[state.lang].details}
        </label>
        <p>${req.details}</p>
      </div>

      ${attachmentHtml}
    `);
  }

  // --- Modals Handlers ---
  function openModal(modalId) {
    $(`#${modalId}`).addClass('active');
  }

  function closeModal(modalId) {
    $(`#${modalId}`).removeClass('active');
  }

  // --- Dropdown Populations Helpers ---
  function populateProjectsSelect(selectId) {
    const select = $(`#${selectId}`);
    select.empty();
    select.append(`<option value="" disabled selected data-i18n="select_project">${i18n[state.lang].select_project}</option>`);
    db.getProjects().forEach(p => {
      const name = state.lang === 'th' ? p.name_th : p.name_en;
      select.append(`<option value="${p.id}">${name}</option>`);
    });
  }

  function populateAgenciesSelect(selectId) {
    const select = $(`#${selectId}`);
    select.empty();
    select.append(`<option value="" disabled selected data-i18n="select_agency">${i18n[state.lang].select_agency}</option>`);
    db.getAgencies().forEach(a => {
      select.append(`<option value="${a.id}">${a.name}</option>`);
    });
  }

  function populateAgentsSelect(selectId, agencyId) {
    const select = $(`#${selectId}`);
    select.empty();
    select.append(`<option value="" data-i18n="select_agent">${i18n[state.lang].select_agent}</option>`);
    
    if (agencyId) {
      db.getAgents(agencyId).forEach(ag => {
        if (ag.active) {
          select.append(`<option value="${ag.id}">${ag.name}</option>`);
        }
      });
    }
  }

  // --- File Upload Simulator ---
  function handleFileSelect(files) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      state.tempAttachments.push({
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB'
      });
    }
    renderTempAttachmentsList();
  }

  function renderTempAttachmentsList() {
    const container = $('#file-list-container');
    container.empty();
    if (state.tempAttachments.length > 0) {
      state.tempAttachments.forEach((att, index) => {
        container.append(`
          <div class="file-info-display">
            <div>
              <i class="fa-solid fa-file-pdf"></i> 
              <span>${att.name} (${att.size})</span>
            </div>
            <button type="button" class="btn btn-secondary btn-sm btn-remove-temp-file" data-index="${index}" style="padding: 2px 6px;">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        `);
      });
    }
  }

  // --- Request Detail Modal (shared by bell items and table rows) ---
  function openRequestDetailModal(id) {
    const req = db.getRequest(id);
    if (!req) return;

    const project = db.getProject(req.projectId);
    const projectName = project ? (state.lang === 'th' ? project.name_th : project.name_en) : '';
    const agent = db.getAgent(req.agentId);
    const agentName = agent ? agent.name : '-';

    const statusBadgeClass = req.status === 'In process' ? 'badge-process' : (req.status === 'Pending' ? 'badge-pending' : 'badge-done');
    const statusText = req.status === 'In process' ? i18n[state.lang].status_in_process : (req.status === 'Pending' ? i18n[state.lang].status_pending : i18n[state.lang].status_done);

    const attachmentList = req.attachments || (req.attachment ? [req.attachment] : []);
    const attachmentHtml = attachmentList.length === 0 ? '' : `
      <div class="public-attachment-section mt-4">
        <label data-i18n="attachment">${i18n[state.lang].attachment}</label>
        <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
          ${attachmentList.map(att => `
            <div class="public-download-card" style="padding:10px 15px;">
              <i class="fa-solid fa-file-pdf"></i>
              <div class="public-download-info" style="margin-left:12px;">
                <h4 style="font-size:13px;">${att.name}</h4>
                <p style="font-size:11px;">${att.size}</p>
              </div>
              <button class="btn btn-primary btn-sm simulate-download-btn" data-filename="${att.name}" style="padding: 4px 8px; font-size: 11px;">
                <i class="fa-solid fa-download"></i> ${i18n[state.lang].download}
              </button>
            </div>
          `).join('')}
        </div>
      </div>`;

    $('#details-content-box').empty().append(`
      <div class="public-detail-grid">
        <div class="public-detail-item">
          <label data-i18n="created_date">${i18n[state.lang].created_date}</label>
          <span>${req.date}</span>
        </div>
        <div class="public-detail-item">
          <label data-i18n="status">${i18n[state.lang].status}</label>
          <span><span class="badge ${statusBadgeClass}">${statusText}</span></span>
        </div>
        <div class="public-detail-item">
          <label data-i18n="act_type">${i18n[state.lang].act_type}</label>
          <span><strong>${i18n[state.lang][req.type] || req.type}</strong></span>
        </div>
        <div class="public-detail-item">
          <label data-i18n="project">${i18n[state.lang].project}</label>
          <span>${projectName}</span>
        </div>
        <div class="public-detail-item">
          <label data-i18n="sender">${i18n[state.lang].sender}</label>
          <span>${req.salesName}</span>
        </div>
        <div class="public-detail-item">
          <label data-i18n="assigned_to">${i18n[state.lang].assigned_to}</label>
          <span>${agentName}</span>
        </div>
      </div>

      <div class="public-description mt-4">
        <label style="font-weight:600; display:block; margin-bottom:8px; font-size:13px; color:var(--text-light); text-transform:uppercase;">
          ${i18n[state.lang].details}
        </label>
        <p>${req.details}</p>
      </div>

      ${attachmentHtml}

      <div class="form-group mt-4" style="border-top: 1px solid var(--border-color); padding-top: 20px;">
        <label for="change-req-status" data-i18n="status">Update Status</label>
        <select id="change-req-status" class="form-control">
          <option value="In process" ${req.status === 'In process' ? 'selected' : ''} data-i18n="status_in_process">${i18n[state.lang].status_in_process}</option>
          <option value="Pending" ${req.status === 'Pending' ? 'selected' : ''} data-i18n="status_pending">${i18n[state.lang].status_pending}</option>
          <option value="Done" ${req.status === 'Done' ? 'selected' : ''} data-i18n="status_done">${i18n[state.lang].status_done}</option>
        </select>
      </div>
    `);

    $('#details-modal-footer').empty().append(`
      <button class="btn btn-secondary modal-close-btn" data-i18n="close">${i18n[state.lang].close}</button>
      <button class="btn btn-primary" id="btn-save-agency-status" data-id="${req.id}">
        <i class="fa-solid fa-save"></i> ${i18n[state.lang].save}
      </button>
    `);

    openModal('modal-view-details');
  }

  // --- Event Bindings Manager ---
  function bindEvents() {
    // Language Toggle
    $(document).on('click', '.toggle-lang', function() {
      applyLanguage($(this).attr('data-lang'));
    });

    // Mobile Sidebar Toggles
    $('#sale-menu-toggle').click(() => $('#sale-sidebar').toggleClass('active'));
    $('#agency-menu-toggle').click(() => $('#agency-sidebar').toggleClass('active'));

    // Handle clicking outside sidebar to close on mobile
    $(document).click(function(event) {
      if (!$(event.target).closest('#sale-sidebar, #sale-menu-toggle').length) {
        $('#sale-sidebar').removeClass('active');
      }
      if (!$(event.target).closest('#agency-sidebar, #agency-menu-toggle').length) {
        $('#agency-sidebar').removeClass('active');
      }
    });

    // --- Authentication ---
    // Switch between Sales and Agency tabs on login screen
    $('.login-tab').click(function() {
      $('.login-tab').removeClass('active');
      $(this).addClass('active');
      const role = $(this).attr('data-role');
      $('#login-role').val(role);
    });

    // Auto-fill demo credentials
    $(document).on('click', '.login-demo-click', function() {
      const user = $(this).text();
      $('#username').val(user);
      $('#password').val('password');
    });

    // Login Form Submit
    $('#login-form').submit(function(e) {
      e.preventDefault();
      const username = $('#username').val().trim();
      const password = $('#password').val();
      const role = $('#login-role').val();

      const user = db.login(username, password);
      if (user && user.role === role) {
        state.currentUser = user;
        sessionStorage.setItem('property_user', JSON.stringify(user));
        
        // Setup Hash listener again if not listening
        $(window).off('hashchange', handleHashChange);
        $(window).on('hashchange', handleHashChange);

        showToast('welcome');
        if (role === 'sale') {
          window.location.hash = '#sale-overview';
        } else {
          window.location.hash = '#agency-requests';
        }
      } else {
        $('#login-error').text(i18n[state.lang].invalid_login).show();
      }
    });

    // Logout
    $(document).on('click', '.logout-btn', function() {
      state.currentUser = null;
      sessionStorage.removeItem('property_user');
      window.location.hash = '#login';
      showLoginView();
    });

    // Close Modals
    $('.modal-close, .modal-close-btn').click(function(e) {
      e.preventDefault();
      const modal = $(this).closest('.modal-overlay');
      closeModal(modal.attr('id'));
    });

    // --- Sales Portal: Manage Agencies ---
    $('#agency-search-input').on('keyup', renderAgencies);

    // Open Add Agency Modal
    $('#btn-add-agency-modal').click(function() {
      $('#agency-form')[0].reset();
      $('#agency-id').val('');
      $('#modal-agency-title').attr('data-i18n', 'add_agency').text(i18n[state.lang].add_agency);
      openModal('modal-agency');
    });

    // Edit Agency
    $(document).on('click', '.edit-agency-btn', function() {
      const id = $(this).attr('data-id');
      const agency = db.getAgency(id);
      if (agency) {
        $('#agency-id').val(agency.id);
        $('#agency-name').val(agency.name);
        $('#agency-phone').val(agency.phone);
        $('#agency-email').val(agency.email);
        $('#agency-address').val(agency.address);

        $('#modal-agency-title').attr('data-i18n', 'edit_agency').text(i18n[state.lang].edit_agency);
        openModal('modal-agency');
      }
    });

    // Delete Agency
    $(document).on('click', '.delete-agency-btn', function() {
      if (confirm(i18n[state.lang].confirm_delete)) {
        const id = $(this).attr('data-id');
        db.deleteAgency(id);
        renderAgencies();
        showToast('success_delete');
      }
    });

    // Submit Agency Form (Add/Edit)
    $('#agency-form').submit(function(e) {
      e.preventDefault();
      const id = $('#agency-id').val();
      const name = $('#agency-name').val().trim();
      const phone = $('#agency-phone').val().trim();
      const email = $('#agency-email').val().trim();
      const address = $('#agency-address').val().trim();

      if (!name || !phone || !email || !address) {
        alert(i18n[state.lang].error_fill_fields);
        return;
      }

      db.saveAgency({ id, name, phone, email, address });
      closeModal('modal-agency');
      renderAgencies();
      showToast('success_save');
    });

    // Go to Agency Detail (Agents View)
    $(document).on('click', '.btn-view-agents', function() {
      state.selectedAgencyId = $(this).attr('data-id');
      $('#agencies-list-view').hide();
      $('#agency-detail-view').show();
      renderAgents();
    });

    // Back to Agencies Directory from Detail view
    $('#btn-back-agencies').click(function() {
      state.selectedAgencyId = null;
      $('#agency-detail-view').hide();
      $('#agencies-list-view').show();
      renderAgencies();
    });

    // --- Sales Portal: Manage Agents ---
    // Open Add Agent Modal
    $('#btn-add-agent-modal').click(function() {
      $('#agent-form')[0].reset();
      $('#agent-id').val('');
      $('#agent-agency-id').val(state.selectedAgencyId);
      $('#modal-agent-title').attr('data-i18n', 'add_agent').text(i18n[state.lang].add_agent);
      openModal('modal-agent');
    });

    // Edit Agent
    $(document).on('click', '.edit-agent-btn', function() {
      const id = $(this).attr('data-id');
      const agent = db.getAgent(id);
      if (agent) {
        $('#agent-id').val(agent.id);
        $('#agent-agency-id').val(agent.agencyId);
        $('#agent-name').val(agent.name);
        $('#agent-phone').val(agent.phone);
        $('#agent-email').val(agent.email);
        $('#agent-status').val(agent.active.toString());

        $('#modal-agent-title').attr('data-i18n', 'edit_agent').text(i18n[state.lang].edit_agent);
        openModal('modal-agent');
      }
    });

    // Delete Agent
    $(document).on('click', '.delete-agent-btn', function() {
      if (confirm(i18n[state.lang].confirm_delete)) {
        const id = $(this).attr('data-id');
        db.deleteAgent(id);
        renderAgents();
        showToast('success_delete');
      }
    });

    // Submit Agent Form (Add/Edit)
    $('#agent-form').submit(function(e) {
      e.preventDefault();
      const id = $('#agent-id').val();
      const agencyId = $('#agent-agency-id').val();
      const name = $('#agent-name').val().trim();
      const phone = $('#agent-phone').val().trim();
      const email = $('#agent-email').val().trim();
      const active = $('#agent-status').val() === 'true';

      if (!name || !phone || !email || !agencyId) {
        alert(i18n[state.lang].error_fill_fields);
        return;
      }

      db.saveAgent({ id, agencyId, name, phone, email, active });
      closeModal('modal-agent');
      renderAgents();
      showToast('success_save');
    });

    // --- Sales Portal: Manage Requests & Creating Activities ---
    $('#request-search-input').on('keyup', renderRequests);
    $('#filter-activity-type, #filter-status').on('change', renderRequests);

    // Open Request Creator Modal
    $('.btn-create-request-modal').click(function() {
      $('#request-form')[0].reset();
      $('#req-id').val('');
      
      // Reset simulated files
      state.tempAttachments = [];
      $('#file-list-container').empty();

      // Populate Selects
      populateProjectsSelect('req-project');
      populateAgenciesSelect('req-agency');
      populateAgentsSelect('req-agent', null);

      $('#modal-request-title').attr('data-i18n', 'create_request').text(i18n[state.lang].create_request);
      openModal('modal-request');
    });

    // Filter agents based on agency selection in dropdown
    $('#req-agency').change(function() {
      const agencyId = $(this).val();
      populateAgentsSelect('req-agent', agencyId);
    });

    // Trigger File Inputs
    $('#file-dropzone').click(function() {
      $('#req-file-input').click();
    });

    $('#req-file-input').change(function() {
      handleFileSelect(this.files);
    });

    // File Drag and Drop Support
    const dropzone = document.getElementById('file-dropzone');
    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        $('#file-dropzone').css('border-color', 'var(--accent)').css('background-color', 'var(--accent-light)');
      });

      dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        $('#file-dropzone').css('border-color', 'var(--border-color)').css('background-color', '#fafafa');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        $('#file-dropzone').css('border-color', 'var(--border-color)').css('background-color', '#fafafa');
        handleFileSelect(e.dataTransfer.files);
      });
    }

    // Remove Selected File
    $(document).on('click', '.btn-remove-temp-file', function(e) {
      e.preventDefault();
      const index = parseInt($(this).attr('data-index'));
      state.tempAttachments.splice(index, 1);
      renderTempAttachmentsList();
      $('#req-file-input').val('');
    });

    // Edit Request Details
    $(document).on('click', '.edit-request-btn', function() {
      const id = $(this).attr('data-id');
      const req = db.getRequest(id);
      if (req) {
        $('#req-id').val(req.id);
        
        populateProjectsSelect('req-project');
        $('#req-project').val(req.projectId);

        populateAgenciesSelect('req-agency');
        $('#req-agency').val(req.agencyId);

        populateAgentsSelect('req-agent', req.agencyId);
        $('#req-agent').val(req.agentId);

        $('#req-type').val(req.type);
        $('#req-details').val(req.details);

        state.tempAttachments = req.attachments ? [...req.attachments] : (req.attachment ? [req.attachment] : []);
        renderTempAttachmentsList();

        $('#modal-request-title').text(i18n[state.lang].edit + ' ' + i18n[state.lang].request_details);
        openModal('modal-request');
      }
    });

    // Delete Request
    $(document).on('click', '.delete-request-btn', function() {
      if (confirm(i18n[state.lang].confirm_delete)) {
        const id = $(this).attr('data-id');
        db.deleteRequest(id);
        
        // Refresh whatever page is active
        if (state.currentRoute === '#sale-overview') {
          renderSaleDashboard();
        } else {
          renderRequests();
        }
        showToast('success_delete');
      }
    });

    // Submit Request Creator Form
    $('#request-form').submit(function(e) {
      e.preventDefault();
      const id = $('#req-id').val();
      const type = $('#req-type').val();
      const projectId = $('#req-project').val();
      const agencyId = $('#req-agency').val();
      const agentId = $('#req-agent').val() || null;
      const details = $('#req-details').val().trim();

      if (!type || !projectId || !agencyId || !details) {
        alert(i18n[state.lang].error_fill_fields);
        return;
      }

      // If editing, preserve original salesName, status, and date
      let originalReq = {};
      if (id) {
        originalReq = db.getRequest(id) || {};
      }

      const requestData = {
        id: id || undefined,
        salesName: originalReq.salesName || state.currentUser.name,
        type,
        projectId,
        agencyId,
        agentId,
        details,
        status: originalReq.status || 'In process',
        attachments: state.tempAttachments
      };

      const saved = db.saveRequest(requestData);
      closeModal('modal-request');

      // Clear the bell cleared state for the agency so they receive a notification
      sessionStorage.removeItem('property_bell_cleared_' + agencyId);

      // Refresh listings
      if (state.currentRoute === '#sale-overview') {
        renderSaleDashboard();
      } else {
        renderRequests();
      }
      showToast('success_save');

      // If it is a new request, auto-trigger sharing modal directly to improve UX!
      if (!id) {
        setTimeout(() => {
          triggerSharingModal(saved.id);
        }, 600);
      }
    });

    // Open Share Modal
    $(document).on('click', '.share-request-btn', function() {
      const id = $(this).attr('data-id');
      triggerSharingModal(id);
    });

    // Helper for Triggering Sharing Links
    function triggerSharingModal(reqId) {
      const shareUrl = window.location.origin + window.location.pathname + '?view_id=' + reqId;
      $('#share-link-input').val(shareUrl);
      
      // Update data attribute for buttons
      $('.share-btn').attr('data-url', shareUrl).attr('data-id', reqId);
      
      openModal('modal-share');
    }

    // Copy Shareable Link Action
    $('#btn-share-copy').click(function() {
      const link = $('#share-link-input');
      link.select();
      document.execCommand('copy');
      
      showToast('copied');
    });

    // Share buttons simulate messaging platforms (opens public request view in new window/tab)
    $('#btn-share-line, #btn-share-facebook, #btn-share-whatsapp').click(function() {
      const url = $(this).attr('data-url');
      // In realistic mock scenario, let's open this link in a new window to show user the public viewing layout!
      window.open(url, '_blank');
      showToast('success_save');
    });

    // Email share — opens mailto: with pre-filled subject and body
    $('#btn-share-email').click(function() {
      const url = $(this).attr('data-url');
      const reqId = $(this).attr('data-id');
      const subject = encodeURIComponent(i18n[state.lang].share_email_subject + ' [' + reqId + ']');
      const body = encodeURIComponent(i18n[state.lang].share_email_body + '\n\n' + url);
      window.location.href = 'mailto:?subject=' + subject + '&body=' + body;
      showToast('success_save');
    });

    // --- Agency Portal: Manage Requests & Inbox ---
    $('#agency-request-search').on('keyup', renderAgencyRequests);
    $('#agency-filter-status').on('change', renderAgencyRequests);

    // View details on incoming requests
    $(document).on('click', '.view-agency-details-btn', function() {
      openRequestDetailModal($(this).attr('data-id'));
    });

    // Save status change inside detail modal
    $(document).on('click', '#btn-save-agency-status', function() {
      const id = $(this).attr('data-id');
      const status = $('#change-req-status').val();

      if (id && status) {
        db.updateRequestStatus(id, status);
        closeModal('modal-view-details');
        renderAgencyRequests();
        showToast('success_save');
      }
    });

    // Close detail modal btn wrapper
    $(document).on('click', '#details-modal-footer .modal-close-btn', function() {
      closeModal('modal-view-details');
    });

    // Simulate Document Download click
    $(document).on('click', '.simulate-download-btn', function() {
      const filename = $(this).attr('data-filename') || 'document.pdf';
      showToast('loading');
      
      // Simulate download trigger after 1 sec
      setTimeout(() => {
        // Create virtual element
        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent('Simulated property document content for ' + filename));
        element.setAttribute('download', filename);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        
        showToast('success_save');
      }, 1000);
    });

    // --- Agency Portal: Member Management ---
    // Open Add Member Modal
    $('#btn-agency-add-member').click(function() {
      $('#agent-form')[0].reset();
      $('#agent-id').val('');
      // Bind member to current agency user's agency
      $('#agent-agency-id').val(state.currentUser.agencyId);
      $('#modal-agent-title').attr('data-i18n', 'add_member').text(i18n[state.lang].add_member);
      openModal('modal-agent');
    });

    // Open Edit Member Modal
    $(document).on('click', '.edit-member-btn', function() {
      const id = $(this).attr('data-id');
      const agent = db.getAgent(id);
      if (agent) {
        $('#agent-id').val(agent.id);
        $('#agent-agency-id').val(agent.agencyId);
        $('#agent-name').val(agent.name);
        $('#agent-phone').val(agent.phone);
        $('#agent-email').val(agent.email);
        $('#agent-status').val(agent.active.toString());

        $('#modal-agent-title').text(i18n[state.lang].edit + ' ' + i18n[state.lang].member_name);
        openModal('modal-agent');
      }
    });

    // Delete Member
    $(document).on('click', '.delete-member-btn', function() {
      if (confirm(i18n[state.lang].confirm_delete)) {
        const id = $(this).attr('data-id');
        db.deleteAgent(id);
        renderAgencyMembers();
        showToast('success_delete');
      }
    });

    // Override the agent-form submission behavior when logged in as agency to refresh agency members table instead
    $('#agent-form').off('submit').submit(function(e) {
      e.preventDefault();
      const id = $('#agent-id').val();
      const agencyId = $('#agent-agency-id').val();
      const name = $('#agent-name').val().trim();
      const phone = $('#agent-phone').val().trim();
      const email = $('#agent-email').val().trim();
      const active = $('#agent-status').val() === 'true';

      if (!name || !phone || !email || !agencyId) {
        alert(i18n[state.lang].error_fill_fields);
        return;
      }

      db.saveAgent({ id, agencyId, name, phone, email, active });
      closeModal('modal-agent');
      
      if (state.currentUser.role === 'sale') {
        renderAgents();
      } else {
        renderAgencyMembers();
      }
      showToast('success_save');
    });

    // --- Agency Notification Bell dropdown and clearing actions ---
    $('#agency-bell').click(function(e) {
      // Ignore clicks that originate from inside the dropdown itself (items, clear btn)
      if ($(e.target).closest('#agency-bell-dropdown').length) return;
      e.stopPropagation();
      $('#agency-bell-dropdown').toggle();
    });

    $(document).click(function() {
      $('#agency-bell-dropdown').hide();
    });

    $('#btn-clear-bell').click(function(e) {
      e.stopPropagation();
      $('#agency-bell-badge').fadeOut();
      $('#agency-bell-dropdown').fadeOut();
      sessionStorage.setItem('property_bell_cleared_' + state.currentUser.agencyId, 'true');
    });

    // Clicking on a bell notification item navigates to Incoming Requests and opens the detail modal
    $(document).on('click', '.bell-item', function(e) {
      e.stopPropagation();
      const reqId = $(this).attr('data-id');
      $('#agency-bell-dropdown').fadeOut();
      window.location.hash = '#agency-requests';
      setTimeout(() => openRequestDetailModal(reqId), 150);
    });

  }

  // --- Notification Bell Badge & Dropdown update helper ---
  function updateNotificationBell() {
    if (!state.currentUser || state.currentUser.role !== 'agency') return;

    const currentAgencyId = state.currentUser.agencyId;
    // Filter requests sent to this agency that are in progress or pending
    const requests = db.getRequests({ agencyId: currentAgencyId });
    const unreadRequests = requests.filter(r => r.status === 'In process' || r.status === 'Pending');

    const bellCleared = sessionStorage.getItem('property_bell_cleared_' + currentAgencyId) === 'true';
    const badge = $('#agency-bell-badge');

    if (unreadRequests.length > 0 && !bellCleared) {
      badge.text(unreadRequests.length).fadeIn().css('display', 'flex');
    } else {
      badge.hide();
    }

    const container = $('#agency-bell-items');
    container.empty();

    if (unreadRequests.length === 0) {
      container.append(`
        <div style="padding: 20px; text-align: center; color: var(--text-light); font-size: 12px;">
          <i class="fa-regular fa-bell-slash" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
          No new notifications
        </div>
      `);
      return;
    }

    // Render up to 5 unread/active requests inside bell dropdown
    unreadRequests.slice(0, 5).forEach(req => {
      const project = db.getProject(req.projectId);
      const projectName = project ? (state.lang === 'th' ? project.name_th : project.name_en) : '';
      const typeText = i18n[state.lang][req.type] || req.type;

      container.append(`
        <div class="bell-item" data-id="${req.id}">
          <div class="bell-item-title">${typeText}</div>
          <div class="bell-item-desc">${projectName} - ${req.salesName}</div>
          <div class="bell-item-date">${req.date}</div>
        </div>
      `);
    });
  }

  // Run initialization
  init();
});
