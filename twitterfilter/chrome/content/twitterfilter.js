var TWITTERFILTER = {
	prefs : null,
	strings : null,
	
	/**
	 * The list of sources currently being filtered.
	 */
	sources : {},
	
	/**
	 * Set up all event listeners.
	 */
	load : function () {
		var firefoxBrowser = document.getElementById("appcontent");

		if (firefoxBrowser) {
			firefoxBrowser.addEventListener("DOMContentLoaded", TWITTERFILTER.DOMContentLoaded, false);
		}
		else {
			var fennecBrowser = document.getElementById("browsers");
		
			if (fennecBrowser) {
				fennecBrowser.addEventListener("load", TWITTERFILTER.DOMContentLoaded, true);
			}
		}
		
		TWITTERFILTER.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.twitterfilter.");	
		TWITTERFILTER.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
		TWITTERFILTER.prefs.addObserver("", TWITTERFILTER, false);
		
		var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
		observerService.addObserver(TWITTERFILTER, "http-on-examine-response", false);
		
		document.addEventListener("TwitterFilterFilter", TWITTERFILTER.filterListener, false, true);
		document.addEventListener("TwitterFilterAllow", TWITTERFILTER.allowListener, false, true);
		
		TWITTERFILTER.strings = document.getElementById("twitterfilter-strings");
		
		TWITTERFILTER.reloadSources();
		
		TWITTERFILTER.showFirstRun();
	},
	
	/**
	 * Destroy all event listeners.
	 */
	unload : function () {
		TWITTERFILTER.prefs.removeObserver("", TWITTERFILTER);
		
		var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
		observerService.removeObserver(TWITTERFILTER, "http-on-examine-response");
		
		removeEventListener("load", TWITTERBAR.load, false);
		removeEventListener("unload", TWITTERBAR.unload, false);
		
		document.removeEventListener("TwitterFilterFilter", TWITTERFILTER.filterListener, false, true);
		document.removeEventListener("TwitterFilterAllow", TWITTERFILTER.allowListener, false, true);
	},
	
	getVersion : function (callback) {
		var addonId = "twitterfilter@efinke.com";
		
		if ("@mozilla.org/extensions/manager;1" in Components.classes) {
			// < Firefox 4
			var version = Components.classes["@mozilla.org/extensions/manager;1"]
				.getService(Components.interfaces.nsIExtensionManager).getItemForID(addonId).version;
			
			callback(version);
		}
		else {
			// Firefox 4.
			Components.utils.import("resource://gre/modules/AddonManager.jsm");  
			
			AddonManager.getAddonByID(addonId, function (addon) {
				callback(addon.version);
			});
		}
	},
	
	showFirstRun : function () {
		function isMajorUpdate(version1, version2) {
			if (!version1) {
				return true;
			}
			else {
				var oldParts = version1.split(".");
				var newParts = version2.split(".");
		
				if (newParts[0] != oldParts[0] || newParts[1] != oldParts[1]) {
					return true;
				}
			}
			
			return false;
		}
		
		function doShowFirstRun(version) {
			if (isMajorUpdate(TWITTERFILTER.prefs.getCharPref("version"), version)) {
				if (typeof Browser != 'undefined' && typeof Browser.addTab != 'undefined') {
					Browser.addTab("http://www.chrisfinke.com/firstrun/twitterfilter.php?v=" + version, true);
				}
				else {
					var browser = getBrowser();
			
					browser.selectedTab = browser.addTab("http://www.chrisfinke.com/firstrun/twitterfilter.php?v=" + version);
				}
			}
			
			TWITTERFILTER.prefs.setCharPref("version", version);
		}
		
		TWITTERFILTER.getVersion(doShowFirstRun);
	},
	
	/**
	 * Add a source to the blacklist.
	 */
	
	blockSource : function (source) {
		TWITTERFILTER.reloadSources();
		
		TWITTERFILTER.sources[source] = true;
		
		var x = [];
		
		for (s in TWITTERFILTER.sources) {
			if (s) {
				x.push(s);
			}
		}
		
		var sourceString = "";
		
		if (x.length > 0) {
			sourceString = x.join("|");
		}
		
		TWITTERFILTER.prefs.setCharPref("badSources", sourceString);
	},
	
	/**
	 * Allow a source back into the stream.
	 */
	
	unblockSource : function (source) {
		TWITTERFILTER.reloadSources();
		
		delete TWITTERFILTER.sources[source];

		var x = [];
		
		for (s in TWITTERFILTER.sources) {
			if (s) {
				x.push(s);
			}
		}
		
		var sourceString = "";
		
		if (x.length > 0) {
			sourceString = x.join("|");
		}
		
		TWITTERFILTER.prefs.setCharPref("badSources", sourceString);
	},
	
	/** 
	 * Repopulate the local source cache from the prefs service.
	 */
	
	reloadSources : function () {
		var sources = TWITTERFILTER.prefs.getCharPref("badSources");
		
		if (sources != "") {
			sources = sources.split("|");
		}
		else {
			sources = [];
		}
		
		TWITTERFILTER.sources = {};
		
		for (var i = 0; i < sources.length; i++) {
			TWITTERFILTER.sources[sources[i]] = true;
		}
	},
	
	/**
	 * Observer for HTTP calls and pref changes.
	 */
	
	observe : function(subject, topic, data) {
		if ((typeof Components == 'undefined') || !Components) return;
		
		if (topic == "http-on-examine-response") {
			var request = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
			
			if (request.URI.spec.match(/^http:\/\/twitter.com\//i)) {
				try {
					if (subject.getRequestHeader("X-Requested-With") == 'XMLHttpRequest'){
						window.addEventListener("MozAfterPaint", TWITTERFILTER.repainted, false);
						setTimeout(function () { 
							window.removeEventListener("MozAfterPaint", TWITTERFILTER.repainted, false);
						}, 3000);
					}
				} catch (notAvailable) {
					// TWITTERFILTER.log(notAvailable);
				}
			}
		}
		else if (topic == "nsPref:changed") {
			switch (data) {
				case "badSources":
					TWITTERFILTER.reloadSources();
					TWITTERFILTER.updateSources();
				break;
			}
		}
	},
	
	/**
	 * Page load event.
	 */
	
	DOMContentLoaded : function (event) {
		try {
			var page = event.target;
			
			if (page.location.host.match(/twitter\.com/)) {
				TWITTERFILTER.filter(page);
				TWITTERFILTER.showSources(page);
			}
		} catch (e) {
			return;
		}
	},
	
	/**
	 * Updates the blocked sources list in the Twitter sidebar.
	 */
	
	updateSources : function () {
		if (typeof gBrowser != 'undefined') {
			var num = gBrowser.browsers.length;
		
			for (var i = 0; i < num; i++) {
				var b = gBrowser.getBrowserAtIndex(i);
			
				try {
					if (b.currentURI.spec.indexOf("twitter.com") != -1) {
						TWITTERFILTER.showSources(b.contentDocument);
					}
				} catch(e) {
					//TWITTERFILTER.log(e);
				}
			}
		}
		else {
			var browsers = Browser.browsers;
			
			for (var i = 0; i < browsers.length; i++) {
				var b = browsers[i];
				
				try {
					if (b.currentURI.spec.indexOf("twitter.com") != -1) {
						TWITTERFILTER.showSources(b.contentDocument);
					}
				} catch(e) {
					// TWITTERFILTER.log(e);
				}
			}
		}
	},
	
	/**
	 * The page has been repainted after a Twitter HTTP request.
	 */
	
	repainted : function () {
		TWITTERFILTER.refilter();
	},
	
	/**
	 * Refilter each Twitter tab.
	 */
	
	refilter : function (force) {
		if (typeof gBrowser != 'undefined') {
			var num = gBrowser.browsers.length;
		
			for (var i = 0; i < num; i++) {
				var b = gBrowser.getBrowserAtIndex(i);
			
				try {
					if (b.currentURI.spec.indexOf("twitter.com") != -1) {
						TWITTERFILTER.filter(b.contentDocument, force);
						TWITTERFILTER.filterBuffer(b.contentDocument);
					}
				} catch(e) {
					// TWITTERFILTER.log(e);
				}
			}
		}
		else {
			var browsers = Browser.browsers;
			
			for (var i = 0; i < browsers.length; i++) {
				var b = browsers[i];
				
				try {
					if (b.currentURI.spec.indexOf("twitter.com") != -1) {
						TWITTERFILTER.filter(b.contentDocument, force);
						TWITTERFILTER.filterBuffer(b.contentDocument);
					}
				} catch(e) {
					// TWITTERFILTER.log(e);
				}
			}
		}
	},
	
	/**
	 * Filter out 'pending' tweets from the top of the page.
	 */
	
	filterBuffer : function (page) {
		var notification = page.getElementById("new_results_notification");
		
		var buffered = page.getElementById("timeline").getElementsByClassName("buffered");
		var newTweets = 0;
		
		if (buffered.length == 0) {
		}
		else {
			for (var i = 0; i < buffered.length; i++) {
				if (!buffered[i].getAttribute("filter")) {
					newTweets++;
				}
			}
		
			if (newTweets == 0) {
				notification.style.display = 'none';
			
				if (page.title.indexOf("(") == 0) {
					var title_parts = page.title.split(" ");
					title_parts.shift();
					page.title = title_parts.join(" ");
				}
			}
			else {
				notification.style.display = '';
				if (newTweets == 1) {
					page.getElementById("results_update").innerHTML = TWITTERFILTER.strings.getString("twitterfilter.oneNewTweet");
				}
				else {
					page.getElementById("results_update").innerHTML = TWITTERFILTER.strings.getFormattedString("twitterfilter.severalNewTweets", [ newTweets ]);
				}
				
				if (page.title.indexOf("(") == 0) {
					var title_parts = page.title.split(" ");
					title_parts.shift();
					page.title = title_parts.join(" ");
				}
			
				page.title = "(" + newTweets + ") " + page.title;
			}
		}
	},
	
	/**
	 * Filter tweets, add (X) to the unfiltered ones.
	 */
	
	filter : function (page, filterAll) {
		var xNode = page.createElement("span");
		xNode.className = "twitterfilter-filter";
		xNode.innerHTML = " " + TWITTERFILTER.strings.getString("twitterfilter.removeSourceLink");
		xNode.setAttribute("onclick", "var e = document.createEvent('Events'); e.initEvent('TwitterFilterFilter', true, false); this.dispatchEvent(e);");
		xNode.setAttribute("style", "cursor: pointer;");
		
		var xpathExpression = "//ol[@id='timeline']//span[@class='meta entry-meta']/span/a";
		
		if (!filterAll) xpathExpression += "[not(@filtered)]";
		
		var sourceNodes = page.evaluate(xpathExpression, page, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
		var source = sourceNodes.iterateNext();
		var sources = [];
	
		while (source) {
			sources.push(source);
			source = sourceNodes.iterateNext();
		}
		
		var _len = sources.length;
		
		for (var i = 0; i < _len; i++) {
			var s = sources[i];
			
			if (!s.getAttribute("filtered") || filterAll) {
				var p = s.parentNode;
				var gggp = p.parentNode.parentNode.parentNode;
				
				if (!s.getAttribute("filtered")) {
					var n = xNode.cloneNode(true);
					n.setAttribute("sourceName", s.innerHTML);
					p.appendChild(n);
					s.setAttribute("filtered", "true");
				}
				
				if (TWITTERFILTER.sources[s.innerHTML]) {
					gggp.style.display = 'none';
					gggp.setAttribute("filter", "true");
				}
				else if (gggp.getAttribute("filter")) {
					gggp.style.display = '';
					gggp.removeAttribute("filter");
				}
				
				if (!filterAll) {
					window.removeEventListener("MozAfterPaint", TWITTERFILTER.repainted, false);
				}
			}
		}
	},
	
	/** 
	 * Adds the blocked sources list to the Twitter sidebar.
	 */
	
	showSources : function (page) {
		var sidebar = page.getElementById("side");
		
		if (sidebar) {
			var sourceList = page.getElementById("twitterfilter-sources");
		
			if (!sourceList) {
				sidebar.appendChild(page.createElement("hr"));
				
				var sourceList = page.createElement("div");
				sourceList.setAttribute("id", "twitterfilter-sources");
				
				sidebar.appendChild(sourceList);
			}
		
			if (sourceList) {
				sourceList.innerHTML = '<h2 class="sidebar-title">'+TWITTERFILTER.strings.getString("twitterfilter.blockedSources")+'</h2><ul class="sidebar-menu" id="twitterfilter-sources-list"></ul>';
				
				var list = page.getElementById("twitterfilter-sources-list");
				
				for (source in TWITTERFILTER.sources) {
					var li = page.createElement("li");
					li.className = "link-title";
					li.innerHTML = '<a href="javascript:void(0);" sourceName="'+source+'" onclick="var e = document.createEvent(\'Events\'); e.initEvent(\'TwitterFilterAllow\', true, false); this.dispatchEvent(e);"><span>'+source+' '+TWITTERFILTER.strings.getString("twitterfilter.removeSourceLink")+'</span></a>';
					list.appendChild(li);
				}
			}
		}
	},
	
	log : function (msg) {
		var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
		consoleService.logStringMessage("TWITTERFILTER: " + msg);
	},
	
	filterListener : function (evt) {
		TWITTERFILTER.blockSource(evt.target.getAttribute("sourceName"));
		TWITTERFILTER.refilter(true);
	},
	
	allowListener : function (evt) {
		TWITTERFILTER.unblockSource(evt.target.getAttribute("sourceName"));
		evt.target.parentNode.style.display = 'none';
		TWITTERFILTER.refilter(true);
	}
};

addEventListener("load", TWITTERFILTER.load, false);
addEventListener("unload", TWITTERFILTER.unload, false);