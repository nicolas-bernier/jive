// flag for recording time and logging to console
var timer = false;

// 0-11 mapped to month name
var months = [
    "January"  , "February", "March"   , "April",
    "May"      , "June"    , "July"    , "August",
    "September", "October" , "November", "December"
];

var sorting = {
    creationDateDesc : "dateCreatedDesc",
    creationDateAsc : "dateCreatedAsc",
    recentActivityDateDesc : "latestActivityDesc",
    recentActivityDateAsc : "latestActivityAsc"
};

var sortFuncs = {
    creationDateDesc : function(a, b) {
        return new Date(b.postDate) - new Date(a.postDate)
    },
    creationDateAsc : function(a, b) {
        return new Date(a.postDate) - new Date(b.postDate)
    },
    recentActivityDateDesc : function(a, b) {
        return new Date(b.lastAct) - new Date(a.lastAct)
    },
    recentActivityDateAsc : function(a, b) {
        return new Date(a.lastAct) - new Date(b.lastAct)
    },
};



// default url endings
var defaultUrlThis = "/content?sortKey=contentstatus%5Bpublished%5D~recentActivityDateDesc&sortOrder=0";
jive.tile.onOpen(function(config, options)
{
    defaultUrlThis = "/content?sortKey=contentstatus%5Bpublished%5D~"+config.sortkey+"&sortOrder="+config.sortorder;

    //console.log('config',config);
    //console.log('options',options);



    // default config vals if no values given
    config.numResults = config.numResults || 10;
    config.place = config.place || "sub";
    config.type = config.type || ["all"];
    if (config.showLink === undefined) { config.showLink = true };
    config.linkText = config.linkText || "See More Recent Content";
    config.linkUrl = config.linkUrl || "";
    if (config.featured === undefined) { config.featured = false; };

    var indexOfQ = config.type.indexOf("question");
    var getQuestions = indexOfQ !== -1;
    var getDiscussions = config.type.indexOf("discussion") !== -1;
    if (getQuestions) {
        config.type.splice(indexOfQ, 1, "discussion");
    }

    // resize tile if the window changes size (responsive)
    window.onresize = resize;

    // resizes window
    function resize() {
        gadgets.window.adjustHeight();
    }

    osapi.jive.corev3.places.get({
        uri: "/places/" + config.placeContainer.placeID
    }).execute(function(container) {
        // set default URL if none set
        //console.log('container:::',container);
        if (config.linkUrl === "") {
            config.linkUrl = container.resources.html.ref + defaultUrlThis;
        }

        var docList = [];
        var pending = 0;
        if (timer) {
            var start = Date.now();
        }
        if (config.showLink && config.linkUrl === "") {
            setDefaultUrl(container.placeID, container.parent, config);
        }

        var places = ["/places/" + container.placeID];

        switch (config.place) {
            case "sub":
            case "choose-sub":
                getSubplaces(container);
                break;
            case "this":
            case "choose":
                if (config.type.indexOf("post") !== -1 || config.type[0] === "all") {
                    container.getBlog().execute(function(blog) {
                        places.push("/places/" + blog.placeID);
                        getContent(0);
                    });
                } else {
                    getContent(0);
                }
                break;
            default:
                getContent(0);
                break;
        }

        function getSubplaces(container) {
            //console.log('getSubplaces-container:',container);
            // get sub-places of this place
            if (container.type !== "blog") {
                pending++;
                var options = {
                    count: 100 // most likely not more than 100
                }
                container.getPlaces(options).execute(function(res) {
                    if (res.error) {
                        var code = res.error.code;
                        var message = res.error.message;
                        //console.log("Error getSubplaces: "+code + " " + message);
                        // present the user with an appropriate error message
                    } else {
                        for (place in res.list) {
                            places.push("/places/" + res.list[place].placeID);
                            getSubplaces(res.list[place]);
                        }
                        pending--;
                        if (pending == 0) {
                            if (timer) {
                                //console.log("getSubplaces " + (Date.now() - start) + " ms");
                            }
                            getContent(0);
                        }
                    }
                });
            }
        }

        function getContent(startIndex) {
            // get the recent content
            var reqOptions = {
                count: config.numResults,
                startIndex: startIndex,
                sort: sorting[config.sortkey],
                fields: "subject,author.displayName,iconCss,lastActivity,published,question,type"
            };
            // add place if not "all places"
            if (config.place !== "all") {
                reqOptions.place = places.join(",");
            }
            // add type if not "all types"
            if (config.type[0] !== "all") {

                for(var typeS in config.type){
                    if(config.type[typeS]){
                        //reqOptions.type = config.type.join(",");
                        if(reqOptions.type == undefined){reqOptions.type='';}
                        reqOptions.type+=config.type[typeS]+',';
                        //console.log('reqOptions -',reqOptions,'typeS',typeS,'config.type[typeS]',config.type[typeS]);
                    }
                }
            }

            //console.log('reqOptions:: ',reqOptions);
            if (timer) {
                var reqTime = Date.now();
            }

            if (config.featured) {
                // console.log('config-featured',config.featured,'reqOptions',reqOptions);
                // osapi.jive.corev3.places.get({uri: reqOptions.place}).execute(function(res) {
                //     options = { fields: reqOptions.fields };
                //     if (config.type[0] !== "all") {
                //         options.filter = "type(" + reqOptions.type + ")";
                //     }
                //     res.getFeaturedContent(options).execute(handleResults);
                // });
                var typeStr = config.type[0] === "all" ? "" : "&filter=type(" + config.type.join(",") + ")";
                osapi.jive.core.get({
                    v: "v3",
                    href: "/contents/featured?filter=place("
                          + reqOptions.place
                          + ")"
                          + typeStr
                          + "&fields=subject,author.displayName,iconCss,lastActivity,published,question,type"
                }).execute(handleResults);
            } else {
                //console.log('reqOptions else',reqOptions);
                osapi.jive.corev3.contents.get(reqOptions).execute(handleResults);
            }

            function handleResults(res) {
                //console.log(res);
                if (res.error) {
                    var code = res.error.code;
                    var message = res.error.message;
                    //console.log(code + " " + message);
                    // present the user with an appropriate error message
                } else {
                    if (timer) {
                        //console.log("getContent: " + (Date.now() - reqTime) + " ms");
                    }
                    //console.log('res.list ::::: ',res.list);
                    for (var el in res.list) {
                        el=res.list[el];
                        if (config.type[0] === "all" || el.type !== "discussion" || (getQuestions && el.question) || (getDiscussions && !el.question) || el.type !== null || el.type !== undefined) {
                            docList.push({
                                subject: replaceCodes(el.subject),
                                url: el.resources.html.ref,
                                author: el.author.displayName,
                                authorUrl: el.author.resources.html.ref,
                                contentType: el.type,
                                iconCss: el.iconCss,
                                avatar: el.author.resources.avatar.ref,
                                lastAct: el.lastActivity,
                                postDate: el.published
                            });
                            if (docList.length >= config.numResults) {
                                break;
                            }
                        }
                    }
                    if ((!getQuestions || !getDiscussions) && (docList.length < config.numResults) && res.links && res.links.next) {
                        getContent(startIndex + config.numResults);
                    } else {
                        showDocs();
                    }
                }
            }
        }

        function showDocs() {
            
            if (timer) {
                var showDocsBegin = Date.now();
            }

            if (config.featured) {
                docList.sort(sortFuncs[config.sortkey]);
            }

            var ul = document.getElementById("ul-list");
            var table = document.getElementById("content-table");
            var link = document.getElementById("link");
			
			//console.log('docList = '+docList)

            for (var doc in docList) {
                // create list node
                doc=docList[doc];
                var li = document.createElement("li");
                li.classList.add("listItem", "showIcon", "ic24");

                // create link
                var a = document.createElement("a");
                a.setAttribute("target", "_top");
                a.setAttribute("href", doc.url);
                var $icon =
                    $("<span>")
                    .addClass("jive-icon-big jive-icon-" + doc.contentType)
                    .addClass(doc.iconCss)
                    .removeClass("jive-icon-sml jive-icon-med jive-icon-huge");
                var docSubj = document.createTextNode(doc.subject);

                $(a).append($icon);
                a.appendChild(docSubj);

                // create timestamp + author
                var tsDiv = document.createElement("div");
                tsDiv.className = "linkDescription";
                tsDiv.appendChild( document.createTextNode(moment(doc.postDate).fromNow() + "  ") );
                var authorUrl = a.cloneNode();
                authorUrl.setAttribute("href", doc.authorUrl);
                var author = document.createTextNode("by " + doc.author);
                authorUrl.appendChild(author);
                tsDiv.appendChild(authorUrl);

                li.appendChild(a);
                li.appendChild(tsDiv);
                ul.appendChild(li);

                // create table row node
                var tr = document.createElement("tr");
                var td1 = document.createElement("td");
                var td2 = td1.cloneNode(), td3 = td1.cloneNode();
                td1.appendChild(a.cloneNode(true));
                var authorUrl2 = authorUrl.cloneNode();
                var avatar = document.createElement("img");
                avatar.classList.add("img-circle", "avatar");
                avatar.setAttribute("src", doc.avatar);
                avatar.setAttribute("height", "30px");
                authorUrl2.appendChild(avatar);
                authorUrl2.appendChild(author.cloneNode());
                td2.appendChild(authorUrl2);
                var postDate = formatDate(doc.postDate);
                var postDateNode = document.createTextNode(postDate);
                td3.appendChild(postDateNode);
                tr.appendChild(td1);
                tr.appendChild(td2);
                tr.appendChild(td3);
                table.appendChild(tr);

                if (ul.children.length >= config.numResults) {
                    break;
                }
            }
            if (config.showLink) {
                link.setAttribute("href", config.linkUrl);
                var linkText = document.createTextNode(config.linkText);
                link.appendChild(linkText);
            }
            document.getElementsByClassName("glyphicon-refresh")[0].style.display = "none";

            if (timer) {
                //console.log("showDocs " + (Date.now() - showDocsBegin) + " ms");
            }
            resize();
        }

        function replaceCodes(str) {
			var theTxt = document.createElement("textarea");
			theTxt.innerHTML = str;
			return theTxt.value;            
        }

        function formatDate(d) {

            var dateStr = moment(d).format('DD');
            if (dateStr.length < 2) {
                dateStr = "0" + dateStr;
            }
            var monthStr = moment(d).format('MMM');
            var yearStr = moment(d).format('YYYY');

            return dateStr + "-" + monthStr + "-" + yearStr;
        }
    });
});
