/*
    Rhino-Require is Public Domain
    <http://en.wikipedia.org/wiki/Public_Domain>
    
    The author or authors of this code dedicate any and all copyright interest
    in this code to the public domain. We make this dedication for the benefit
    of the public at large and to the detriment of our heirs and successors. We
    intend this dedication to be an overt act of relinquishment in perpetuity of
    all present and future rights to this code under copyright law.
 */

(function(global) {

    var require = global.require = function(id) {
        var moduleContent = '',
            moduleUri;
        
        moduleUri = toAbsolute( require.resolve(id) );
        moduleContent = '';

        var file = new java.io.File(moduleUri);
        try {    
            var scanner = new java.util.Scanner(file).useDelimiter("\\Z");
            moduleContent = String( scanner.next() );
        }
        catch(ignored) {
            throw 'Unable to read file at: '+moduleUri;
        }
        
        if (moduleContent) {
                try {
                    var f = new Function('require', 'exports', 'module', moduleContent),
                    exports = require.cache[moduleUri] || {},
                    module = { id: id, uri: moduleUri };
        
                
                    require._root.unshift(moduleUri);
                    f.call({}, require, exports, module);
                    require._root.shift();
                }
                catch(e) {
                    throw 'Unable to require source code from "' + moduleUri + '": ' + e.toSource();
                }
                
                exports = module.exports || exports;
                require.cache[id] = exports;
        }
        else {
            throw 'The requested module cannot be returned: no content for id: "' + id + '" in paths: ' + require.paths.join(', ');
        }
        
        return exports;
    }
    require._root = [''];
    require.paths = [];
    require.cache = {}; // cache module exports. Like: {id: exported}
    
    /** Given a module id, try to find the path to the associated module.
     */
    require.resolve = function(id) {
        // TODO: 1. load node core modules
        
        // 2. dot-relative module id, like './foo/bar'
        var parts = id.match(/^(\.\/)(.+)$/),
            isRelative = false,
            basename = id;
        
        if (parts) {
            isRelative = !!parts[1];
            basename = parts[2];
        }
        
        if (typeof basename !== 'undefined') {
            var root = (isRelative? toDir(require._root[0] || '.') : '.'),
                rootedId = root + '/' + basename,
                uri = '';
            
            if ( uri = loadAsFile(rootedId) ) {
                //return uri;
            }
            else if ( uri = loadAsDir(rootedId) ) {
                //return uri;
            }
            else if ( uri = loadNodeModules(rootedId) ) {
                //return uri;
            }
            else if ( uri = nodeModulesPaths(rootedId) ) {
                //return uri;
            }
            
            if (uri !== '') return toAbsolute(uri);
            
            throw 'Require Error: Not found.';
        }
    }
    
    /** Given a path, return the base directory of that path.
        @example toDir('/foo/bar/somefile.js'); => '/foo/bar'
     */
    function toDir(path) {
        var file = new java.io.File(path);
        
        if (file.isDirectory()) {
           return path;
        }
        
        var parts = path.split(/[\\\/]/);
        parts.pop();
        
        return parts.join('/');
    }
    
    /** Returns true if the given path exists and is a file.
     */
    function isFile(path) {
        var file = new java.io.File(path);
        
        if (file.isFile()) {
           return true;
        }
        
        return false;
    }
    
    /** Returns true if the given path exists and is a directory.
     */
    function isDir(path) {
        var file = new java.io.File(path);
        
        if (file.isDirectory()) {
           return true;
        }
        
        return false;
    }
    
    /** Get the path of the current working directory
     */
    function getCwd() {
        return toDir( ''+new java.io.File('.').getAbsolutePath() ).replace(/\/\.$/, '');
    }
    
    function toAbsolute(relPath) {
        absPath = ''+new java.io.File(relPath).getAbsolutePath();
        absPath = absPath.replace(/\/[^\/]+\/\.\.\//g, '/').replace(/\/\.\//g, '/');
        return absPath;
    }
    
    /** Assume the id is a file, try to find it.
     */
    function loadAsFile(id) {
        if ( isFile(id) ) { return id; }
        
        if ( isFile(id+'.js') ) { return id+'.js'; }
        
        if ( isFile(id+'.node') ) { throw 'Require Error: .node files not supported'; }
    }
    
    /** Assume the id is a directory, try to find a module file within it.
     */
    function loadAsDir(id) {
        if (!isDir(id)) {
            id = toDir(id);
        }
        
        // look for the "main" property of the package.json file
        if ( isFile(id+'/package.json') ) {
            var packageJson = readFileSync(id+'/package.json', 'utf-8');
            eval( 'packageJson = '+ packageJson);
            if (packageJson.hasOwnProperty('main')) {
                return (id + '/' + packageJson.main).replace(/\/\.?\//g, '/');
            }
        }
        
        if ( isFile(id+'/index.js') ) {
            return id+'/index.js';
        }
    }
    
    function loadNodeModules(id) {
        var path,
            uri;
        for (var i = 0, len = require.paths.length; i < len; i++) {
            path = require.paths[i];
            if (isDir(path)) {
                path = (path + '/' + id).replace(/\/\.?\//g, '/');
                
                uri = loadAsFile(path);
                if (typeof uri !== 'undefined') {
                    return uri;
                }
                
                uri = loadAsDir(path);
                if (typeof uri !== 'undefined') {
                    return uri;
                }
            }
        }
    }
    
    function nodeModulesPaths(id) {
        var cwd = getCwd(),
            dirs = cwd.split('/'),
            dir,
            path,
            filename,
            uri;

        while (dirs.length) {
            dir = dirs.join('/');
            path = dir+'/node_modules';

            if ( isDir(path) ) {
                filename = (path+'/'+id).replace(/\/\.?\//g, '/');
                
                if ( uri = loadAsFile(filename) ) {
                    uri = uri.replace(cwd, '.');
                    return uri;
                }
                
                if ( uri = loadAsDir(filename) ) {
                    uri = uri.replace(cwd, '.');
                    return uri;
                }
            }

            dirs.pop();
        }
    }
    
    function readFileSync(filename, encoding, callback) {
        if (typeof arguments[1] === 'function') {
            encoding = null;
            callback = arguments[1];
        }
        
        encoding = encoding || java.lang.System.getProperty('file.encoding');
        
        try {
            var content = new java.util.Scanner(
                new java.io.File(filename),
                encoding
            ).useDelimiter("\\Z");
            
            return String( content.next() );
        }
        catch (e) {
            return '';
        }
    }

})(this);