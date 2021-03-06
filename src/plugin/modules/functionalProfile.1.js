define([
    'bluebird',
    'kb_common/html',
    'knockout-plus',
    'numeral',
    'kb_common/jsonRpc/genericClient',
    'kb_common/jsonRpc/dynamicServiceClient',
    'kb_service/utils'
], function (
    Promise,
    html,
    ko,
    numeral,
    GenericClient,
    DynamicServiceClient,
    serviceUtils
) {
    'use string';

    var t = html.tag,
        div = t('div'),
        span = t('span'),
        h3 = t('h3'),
        a = t('a'),
        button = t('button'),
        p = t('p'),
        table = t('table'),
        tr = t('tr'),
        th = t('th'),
        td = t('td');

    function calcScalex(value, scaleMin, scaleMax) {
        // min and max are -ish
        function log(v) {
            // return Math.log(v) / Math.log(4);
            return Math.log10(v);
        }
        var max = Math.abs(log(scaleMin));
        var min = Math.abs(log(scaleMax));
        var range = Math.abs(max - min);
        var val = Math.abs(log(value));
        var val2 = Math.abs(log(scaleMax) - log(value));
        console.log('scale', min, max, val, range);
        if (val > max) {
            return 1;
        }
        if (val < min) {
            return 0;
        }
        // var scaled = Math.abs(val / max);
        var scaled = (val - min) / range;
        console.log('scaled', scaled);
        return scaled;
    }

    function calcScale(value) {
        if (value <= 0.0001) {
            return 1;
        }
        if (value <= 0.001) {
            return 0.8;
        }
        if (value <= 0.01) {
            return 0.6;
        }
        if (value <= 0.05) {
            return 0.4;
        }
        return 0.2;
    }

    function factory(config) {
        var runtime = config.runtime,
            hostNode, container;

        var vm;

        var dsClient = new DynamicServiceClient({
            url: runtime.config('services.service_wizard.url'),
            token: runtime.service('session').getAuthToken(),
            module: 'GeneOntologyDecorator'
        });

        var widgetConfig = {
            x: 150,
            y: 150,
            fontFamily: 'sans serif',
            fontSize: 11,
            radius: 80,
            minRadius: 50,
            radialLength: 100,
            ringWidth: 10,
            sectorCount: ko.observable(5),
            tickTheta: 0.05,
            tickLength: 6, // in pixels
            ringLayout: ['reference', 'kbase', 'fitness', 'expression'],
            leftMargin: 10,
            goConfig: {
                reference: {
                    label: 'Ref',
                    // black
                    color: [0, 0, 0],
                },
                kbase: {
                    label: 'Kbase',
                    // orange
                    color: [249, 124, 0]
                },
                fitness: {
                    label: 'Fitness',
                    // green
                    color: [33, 140, 56]
                },
                expression: {
                    label: 'Expression',
                    // purple
                    color: [130, 61, 142]
                }
            },
            // legend: {
            //     leftMargin: 10,
            //     top: 300,
            //     swatchSize: 10
            // }
        };

        // var workspaceClient = new GenericClient({
        //     url: runtime.config('services.workspace.url'),
        //     token: runtime.service('session').getAuthToken(),
        //     module: 'Workspace'
        // });



        function viewModel(params) {

            // CORE DATA FETCHING 

            function fetchFeatures() {
                return dsClient.callFunc('listFeatures', [{
                        genome_ref: selectedGenome().ref
                    }])
                    .spread(function (featuresList) {
                        return featuresList.slice(0, 10);
                    });
            }

            function fetchTermRelations() {
                return dsClient.callFunc('getTermRelations', [{
                        feature_guid: selectedFeature().feature_guid
                    }])
                    .spread(function (result) {
                        return result;
                    });
            }

            // VIEW MODEL UPDATING FROM FETCHES

            // Genomes
            var selectedGenome = ko.observable({
                ref: params.ref
            });

            function doUnselectFeature() {
                selectedFeature(null);
            }


            // Features
            var fetchingFeatures = ko.observable(false);
            var features = ko.observableArray();
            var selectedFeature = ko.observable();

            function updateFeatures() {
                fetchingFeatures(true);
                fetchFeatures()
                    .then(function (foundFeatures) {
                        features.removeAll();

                        foundFeatures.forEach(function (feature) {
                            features.push(feature);
                        });
                        fetchingFeatures(false);
                    });
            }

            // Term Relations
            var termRelations = ko.observable();
            var fetchingTermRelations = ko.observable(false);

            function makeColor(rgbColor, alpha) {
                return 'rgba(' + rgbColor.join(',') + ',' + alpha + ')';
            }

            function updateTermRelations() {
                fetchingTermRelations(true);
                fetchTermRelations()
                    .then(function (fetchedTermRelations) {

                        // var community = fetchedTermRelations.filter(function(relation) {
                        //     return (relation.relation_type === 'community');
                        // })[0].term_position;

                        // fetchedTermRelations.forEach(function(relation) {
                        //     relation.term_position -= community;
                        // });

                        Object.keys(fetchedTermRelations).forEach(function (typeName) {
                            var relationType = fetchedTermRelations[typeName];
                            var typeConfig = widgetConfig.goConfig[typeName];
                            relationType.terms.forEach(function (term) {
                                term.best = (term.term_guid === relationType.best_term.term_guid);
                                // var alpha = 1 - Math.pow(term.pvalue, 1 / 5);
                                //var log = Math.abs(Math.log(term.pvalue) / Math.log(4));
                                // var alpha = Math.min(log, 10) / 10;
                                var alpha = calcScale(term.pvalue, 0.0001, 0.1);
                                term.alpha = alpha;
                                term.color = makeColor(typeConfig.color, alpha);
                            });
                            relationType.terms.sort(function (a, b) {
                                return a.pvalue - b.pvalue;
                            });
                        });

                        termRelations(fetchedTermRelations);
                    });
            }

            function clearTermRelations() {
                termRelations(null);
            }

            // Subscriptions

            selectedGenome.subscribe(function (newValue) {
                if (newValue) {
                    updateFeatures();
                }
            });

            selectedFeature.subscribe(function (newFeature) {
                if (newFeature) {
                    updateTermRelations();
                } else {
                    clearTermRelations();
                }
            });

            // Layout control

            var layout = {
                features: {
                    collapsed: ko.observable(true),
                    active: ko.observable(false),
                    width: ko.observable()
                },
                relations: {
                    collapsed: ko.observable(true)
                },
                widget: {
                    collapsed: ko.observable(true)
                }
            };

            function toggleFeaturesColumn() {
                layout.features.collapsed(layout.features.collapsed() ? false : true);
            }

            selectedGenome.subscribe(function (newValue) {
                selectedFeature(null);
                if (newValue) {
                    layout.features.collapsed(false);
                    layout.relations.collapsed(true);
                }
            });

            selectedFeature.subscribe(function (newValue) {
                if (newValue) {
                    layout.features.collapsed(true);
                    layout.relations.collapsed(false);
                }
            });

            // Main entry point

            return {
                runtime: runtime,

                selectedGenome: selectedGenome,
                fetchingFeatures: fetchingFeatures,
                features: features,
                selectedFeature: selectedFeature,
                fetchingTermRelations: fetchingTermRelations,
                termRelations: termRelations,
                layout: layout,
                toggleFeaturesColumn: toggleFeaturesColumn,

                // ACTIONS
                doUnselectFeature: doUnselectFeature
            };
        }

        function render() {
            container.innerHTML = div({
                class: 'container-fluid'
            }, [
                div({
                    class: 'row'
                }, [
                    div({
                        class: 'col-sm-3',
                    }, [
                        h3('Selections'),
                        p('Select a gene to display the functional profile.'),
                        div({
                            class: 'well',
                        }, [
                            '<!-- ko if: vm.selectedFeature() -->',
                            div({
                                dataBind: {
                                    with: 'vm.selectedFeature'
                                }
                            }, [
                                div({
                                    style: {
                                        fontWeight: 'bold',
                                        color: '#FFF',
                                        backgroundColor: '#777',
                                        padding: '4px',
                                        marginBottom: '4px',
                                        textAlign: 'center'
                                    }
                                }, [
                                    'Selected Feature'
                                ]),
                                table({
                                    class: 'table'
                                }, [
                                    tr([
                                        th('Id'),
                                        td({
                                            dataBind: {
                                                text: 'feature_guid'
                                            }
                                        })
                                    ]),
                                    tr([
                                        th('Name'),
                                        td({
                                            dataBind: {
                                                text: 'feature_name'
                                            }
                                        })
                                    ]),
                                    tr([
                                        th('Distance'),
                                        td({
                                            dataBind: {
                                                numberText: 'distance',
                                                numberFormat: '"0.00"'
                                            }
                                        })
                                    ]),
                                    tr([
                                        th('Reference'),
                                        td([
                                            div({
                                                dataBind: {
                                                    text: 'reference_term_name'
                                                }
                                            }),
                                            div({
                                                dataBind: {
                                                    text: 'reference_term_guid'
                                                },
                                                style: {
                                                    fontStyle: 'italic'
                                                }
                                            })
                                        ])
                                    ]),
                                    tr([
                                        th('KBase'),
                                        td([
                                            div({
                                                dataBind: {
                                                    text: 'kbase_term_name'
                                                }
                                            }),
                                            div({
                                                dataBind: {
                                                    text: 'kbase_term_guid'
                                                },
                                                style: {
                                                    fontStyle: 'italic'
                                                }
                                            })
                                        ])
                                    ])
                                ]),
                                button({
                                    class: 'btn btn-default',
                                    dataBind: {
                                        click: '$root.vm.doUnselectFeature'
                                    }
                                }, 'Clear &amp; Select Another Gene')
                            ]),
                            '<!-- /ko -->',
                            '<!-- ko if: vm.selectedGenome() && !vm.selectedFeature() -->',
                            'select a gene',
                            '<!-- /ko -->'
                        ]),
                    ]),
                    '<!-- ko if: !vm.selectedGenome() -->',
                    div({
                        class: 'col-sm-9',
                    }, [
                        'houston? problem.'
                    ]),
                    '<!-- /ko -->',
                    '<!-- ko if: vm.selectedGenome() && !vm.selectedFeature()-->',
                    div({
                        class: 'col-sm-9'
                    }, [
                        h3('Genes'),
                        p('Select a gene'),
                        div({
                            dataBind: {
                                component: {
                                    name: '"reske/genome-browser/features/ui"',
                                    params: {
                                        runtime: 'vm.runtime',
                                        selectedGenome: 'vm.selectedGenome',
                                        selectedFeature: 'vm.selectedFeature',
                                        fetchingFeatures: 'vm.fetchingFeatures'
                                    }
                                }
                            }
                        })
                    ]),
                    '<!-- /ko -->',
                    '<!-- ko if: vm.selectedGenome() && vm.selectedFeature() && vm.termRelations()-->',
                    div({
                        class: 'col-sm-9',

                    }, [
                        h3('Widget'),
                        div({
                            dataBind: {
                                component: {
                                    name: '"reske/gene-term/term-comparison-viewer"',
                                    params: {
                                        vm: 'vm'
                                    }
                                }
                            }
                        })
                    ]),
                    '<!-- /ko -->'
                ])
            ]);
            ko.applyBindings({ vm: vm }, container);
        }

        function attach(node) {
            hostNode = node;
            container = hostNode.appendChild(document.createElement('div'));
        }

        function start(params) {
            runtime.send('ui', 'setTitle', 'Knowledge Engine Functional Profile Viewer');
            vm = viewModel(params);
            render();
        }

        function stop() {

        }

        function detach() {}

        return {
            attach: attach,
            start: start,
            stop: stop,
            detach: detach
        };
    }

    return {
        make: function (config) {
            return factory(config);
        }
    };
});