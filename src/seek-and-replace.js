const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const micromatch = require('micromatch');

class SeekdAndReplace {
    constructor(namespace = '', replacePath, keyDefinitions, options) {
        this.namespace = namespace;
        this.path = replacePath;
        this.keyDefinitions = keyDefinitions;

        // set options
        const DEFAULT_OPTIONS = {
            ignorePaths: {},
        };
        this.options = Object.assign({}, DEFAULT_OPTIONS, options)
    }

    replace() {
        return this.renameDirectoriesAndFiles(this.path);
    }

    renameDirectoriesAndFiles(dirPath) {
        return new Promise((resolve, reject) => {
            const keyDefinitionPromList = this.keyDefinitions.map((keyDefinition) => {
                const contents = fs.readdirSync(dirPath);

                return new Promise((resolve, reject) => {
                    const renamePromList = contents.map((contentItem) => {
                        return this.renamePathWithDefinition(dirPath, contentItem, keyDefinition);
                    });

                    Promise.all(renamePromList)
                        .then(resolve)
                        .catch(reject);
                });
            });

            Promise.all(keyDefinitionPromList)
                .then(resolve)
                .catch(reject);
        });
    }

    renamePathWithDefinition(dirPath, item, keyDefinition) {
        const replacedString = SeekdAndReplace.smartReplace(this.namespace, item, keyDefinition.key, keyDefinition.replacement);
        const oldPath = path.join(dirPath, item);
        const newPath = path.join(dirPath, replacedString);
        const shouldBeRenamed = !pathShouldBeIgnored(oldPath, this.options.ignorePaths);

        let stats = fs.statSync(oldPath);
        if (oldPath !== newPath && shouldBeRenamed) {
            fs.renameSync(oldPath, newPath);
            stats = fs.statSync(newPath);
        }

        if (stats.isDirectory()) {
            return this.renameDirectoriesAndFiles(newPath);
        } else if (stats.isFile()) {
            return this.renameFileContents(newPath);
        } else {
            return Promise.resolve();
        }
    }


    renameFileContents(filePath) {
        return new Promise((resolve, reject) => {
            const promList = this.keyDefinitions.map((keyDefinition) => {
                this.renameFileContentWithDefinition(filePath, keyDefinition);
            });

            Promise.all(promList)
                .then(resolve)
                .catch(reject);
        });
    }

    renameFileContentWithDefinition(filePath, keyDefinition) {
        const fileContents = fs.readFileSync(filePath, { encoding: 'utf8' });
        const replacedFileContents = SeekdAndReplace.smartReplace(this.namespace, fileContents, keyDefinition.key, keyDefinition.replacement);

        if (fileContents !== replacedFileContents) {
            fs.writeFileSync(filePath, replacedFileContents);
        }

        return Promise.resolve();
    }

    static smartReplace(namespace, string, key, replacement) {
        const namespacedKey = '_' + _.compact([namespace, key]).join('_');

        if (_.includes(string, 'AS_DOMAIN')) {
            let transformedReplacement = _.chain(replacement).camelCase().toLower().value();
            return _.replace(string, new RegExp(`${namespacedKey}_AS_DOMAIN_`, 'g'), transformedReplacement);

        } else if (_.includes(string, 'WITHOUT_SPACES')) {
            let transformedReplacement = replacement.split(' ').join('');
            return _.replace(string, new RegExp(`${namespacedKey}_WITHOUT_SPACES_`, 'g'), transformedReplacement);

        } else if (_.includes(string, 'LOWER_CASE')) {
            let transformedReplacement = _.lowerCase(replacement);
            return _.replace(string, new RegExp(`${namespacedKey}_LOWER_CASE_`, 'g'), transformedReplacement);

        } else if (_.includes(string, 'UPPER_CASE')) {
            let transformedReplacement = _.upperCase(replacement);
            return _.replace(string, new RegExp(`${namespacedKey}_UPPER_CASE_`, 'g'), transformedReplacement);

        } else if (_.includes(string, 'SNAKE_CASE')) {
            let transformedReplacement = _.snakeCase(replacement);
            return _.replace(string, new RegExp(`${namespacedKey}_SNAKE_CASE_`, 'g'), transformedReplacement);

        } else if (_.includes(string, 'CAMEL_CASE')) {
            let transformedReplacement = _.camelCase(replacement);
            return _.replace(string, new RegExp(`${namespacedKey}_CAMEL_CASE_`, 'g'), transformedReplacement);

        } else if (_.includes(string, 'KEBAB_CASE')) {
            let transformedReplacement = _.kebabCase(replacement);
            return _.replace(string, new RegExp(`${namespacedKey}_KEBAB_CASE_`, 'g'), transformedReplacement);

        } else if (_.includes(string, 'START_CASE')) {
            let transformedReplacement = _.startCase(replacement);
            return _.replace(string, new RegExp(`${namespacedKey}_START_CASE_`, 'g'), transformedReplacement);

        } else {
            return _.replace(string, new RegExp(`${namespacedKey}_`, 'g'), replacement);
        }
    }
}

function pathShouldBeIgnored(dirPath, ignorePaths) {
    return _.some(ignorePaths, function (ignorePath) {
        return micromatch.contains(dirPath, ignorePath, { dot: true });
    });
}

module.exports = SeekdAndReplace