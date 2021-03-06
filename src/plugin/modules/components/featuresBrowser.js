define([
    'kb_common/html'
], function(
    html
) {
    'use strict';

    var t = html.tag,
        div = t('div'),
        button = t('button'),
        table = t('table'),
        thead = t('thead'),
        tr = t('tr'),
        th = t('th'),
        tbody = t('tbody'),
        td = t('td');

    function viewModel(params) {
        function doSelectFeature(data) {
            params.vm.selectedFeature(data);
        }
        return {
            doSelectFeature: doSelectFeature,
            vm: params.vm
        };
    }

    function template() {
        return table({
            class: 'table table-striped',
        }, [
            thead([
                tr([
                    th('Name'),
                    th('Distance'),
                    th('Reference'),
                    th(),
                    th('KBase'),
                    th(),
                    th()
                ])
            ]),
            tbody({
                dataBind: {
                    foreach: 'vm.features'
                }
            }, [
                tr([
                    td({
                        dataBind: {
                            text: 'feature_name'
                        }
                    }),
                    td({
                        dataBind: {
                            numberText: 'distance',
                            numberFormat: '0,0'
                        }
                    }),
                    td({
                        dataBind: {
                            text: 'reference_term_name'
                        }
                    }),
                    td({
                        dataBind: {
                            text: 'reference_term_guid'
                        }
                    }),
                    td({
                        dataBind: {
                            text: 'kbase_term_name'
                        }
                    }),
                    td({
                        dataBind: {
                            text: 'kbase_term_guid'
                        }
                    }),

                    td({
                        style: {
                            textAlign: 'right'
                        }
                    }, button({
                        dataBind: {
                            click: '$component.doSelectFeature'
                        },
                        class: 'btn btn-default'
                    }, '>'))
                ])
            ])
        ]);
    }

    function component() {
        return {
            viewModel: viewModel,
            template: template()
        };
    }
    return component;
});